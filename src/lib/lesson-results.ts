import type { LessonActivityRecord, LessonHistoryEntry } from './types';

// Aggregates a single completed lesson's activity (graded responses + questions) into
// the numbers the post-lesson results page shows. Pure + side-effect free so it can be
// unit-tested; the route just feeds it the persisted records + history entry.

export interface ResultMistake {
  category: string;
  description: string;
  severity: 'high' | 'med' | 'low';
  atOffsetSec: number | null; // seconds into the lesson, when computable
  youSaid: string;
  target?: string;
  sectionName?: string;
}

export interface LessonResults {
  lessonTitle: string;
  completed: boolean;
  durationSec: number | null;
  responseCount: number;
  questionCount: number;
  score: number | null;            // 0–100, averaged from grade labels
  labelCounts: Record<string, number>;
  avgRecallSec: number | null;     // avg lead-in before speaking (time to respond)
  avgWpm: number | null;
  mistakes: ResultMistake[];
  mistakeCounts: { total: number; new: number; recurring: number };
  conceptsCovered: string[];       // section names practiced, in order
  wentWell: string[];
}

const LABEL_SCORE: Record<string, number> = { Excellent: 100, Good: 85, Ok: 70, Almost: 50, Ouch: 25 };
const LABEL_SEV: Record<string, 'high' | 'med' | 'low'> = { Ouch: 'high', Almost: 'med', Ok: 'low', Good: 'low', Excellent: 'low' };

type ResponseRecord = Extract<LessonActivityRecord, { type: 'response' }>;
const isResponse = (r: LessonActivityRecord): r is ResponseRecord => r.type === 'response';

const avg = (a: number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function summarizeLessonResults(args: {
  lessonId: string;
  records: LessonActivityRecord[]; // ALL of the user's activity records (across lessons)
  history?: LessonHistoryEntry;
  fallbackTitle?: string;
}): LessonResults {
  const { lessonId, records, history, fallbackTitle } = args;

  const thisLesson = records.filter((r) => r.lessonId === lessonId);
  const responses = thisLesson.filter(isResponse);
  const questionCount = thisLesson.filter((r) => r.type === 'question').length;

  const lessonTitle = history?.title || responses[0]?.lessonTitle || fallbackTitle || 'Your lesson';

  // Duration — wall clock from start to last access, with the activity-timestamp span
  // as a fallback. Guard against absurd values (e.g. a lesson left open for hours).
  let durationSec: number | null = null;
  if (history?.startedAt && history?.lastAccessedAt) {
    const d = (new Date(history.lastAccessedAt).getTime() - new Date(history.startedAt).getTime()) / 1000;
    if (d > 0 && d < 6 * 60 * 60) durationSec = Math.round(d);
  }
  if (durationSec == null && responses.length > 1) {
    const ts = responses.map((r) => new Date(r.at).getTime()).sort((a, b) => a - b);
    const d = (ts[ts.length - 1] - ts[0]) / 1000;
    if (d > 0) durationSec = Math.round(d);
  }

  // Score + label distribution
  const labelCounts: Record<string, number> = {};
  let scoreSum = 0;
  let scoreN = 0;
  for (const r of responses) {
    const label = r.grade?.label;
    if (!label) continue;
    labelCounts[label] = (labelCounts[label] ?? 0) + 1;
    const s = LABEL_SCORE[label];
    if (s != null) { scoreSum += s; scoreN++; }
  }
  const score = scoreN > 0 ? Math.round(scoreSum / scoreN) : null;

  // Timing averages
  const recall: number[] = [];
  const wpm: number[] = [];
  for (const r of responses) {
    if (r.timing?.initialSilenceSec != null) recall.push(r.timing.initialSilenceSec);
    if (r.timing?.wpm) wpm.push(r.timing.wpm);
  }
  const avgRecall = avg(recall);
  const avgWpmRaw = avg(wpm);
  const avgRecallSec = avgRecall != null ? Math.round(avgRecall * 10) / 10 : null;
  const avgWpm = avgWpmRaw != null ? Math.round(avgWpmRaw) : null;

  // Categories seen in EARLIER lessons → used to mark a mistake "recurring" vs "new".
  const lessonStart = history?.startedAt
    ? new Date(history.startedAt).getTime()
    : responses[0] ? new Date(responses[0].at).getTime() : Infinity;
  const priorCategories = new Set<string>();
  for (const r of records) {
    if (!isResponse(r) || r.lessonId === lessonId) continue;
    if (new Date(r.at).getTime() >= lessonStart) continue;
    for (const e of r.grade?.observed_errors ?? []) priorCategories.add(e.category.toLowerCase());
  }

  // Mistakes — one entry per observed error; weak labels with no explicit error still count.
  const mistakes: ResultMistake[] = [];
  for (const r of responses) {
    const g = r.grade;
    if (!g) continue;
    const errs = g.observed_errors ?? [];
    const weak = g.label === 'Ouch' || g.label === 'Almost' || g.label === 'Ok';
    if (errs.length === 0 && !weak) continue;
    const atOffsetSec = history?.startedAt
      ? Math.max(0, Math.round((new Date(r.at).getTime() - new Date(history.startedAt).getTime()) / 1000))
      : null;
    const target = g.correct_answer || g.suggested_answer || r.expected;
    const base = { severity: LABEL_SEV[g.label] ?? 'low', atOffsetSec, youSaid: r.transcript, target, sectionName: r.sectionName } as const;
    if (errs.length > 0) {
      for (const e of errs) mistakes.push({ category: e.category, description: e.description || g.brief_feedback || '', ...base });
    } else {
      mistakes.push({ category: g.label, description: g.brief_feedback || '', ...base });
    }
  }
  const newCount = mistakes.filter((m) => !priorCategories.has(m.category.toLowerCase())).length;

  // Concepts covered — distinct section names, in order of first appearance.
  const conceptsCovered: string[] = [];
  for (const r of thisLesson) {
    const s = r.sectionName;
    if (s && !conceptsCovered.includes(s)) conceptsCovered.push(s);
  }
  if (conceptsCovered.length === 0 && history?.topics?.length) conceptsCovered.push(...history.topics);

  // What went well — count of strong responses + the sections they nailed.
  const goodN = (labelCounts.Excellent ?? 0) + (labelCounts.Good ?? 0);
  const wellSections: string[] = [];
  for (const r of responses) {
    if ((r.grade?.label === 'Excellent' || r.grade?.label === 'Good') && r.sectionName && !wellSections.includes(r.sectionName)) {
      wellSections.push(r.sectionName);
    }
  }
  const wentWell: string[] = [];
  if (responses.length > 0 && goodN > 0) wentWell.push(`${goodN} of ${responses.length} responses were strong`);
  for (const s of wellSections.slice(0, 3)) wentWell.push(`Solid on “${s}”`);

  return {
    lessonTitle,
    completed: history?.completed ?? false,
    durationSec,
    responseCount: responses.length,
    questionCount,
    score,
    labelCounts,
    avgRecallSec,
    avgWpm,
    mistakes,
    mistakeCounts: { total: mistakes.length, new: newCount, recurring: mistakes.length - newCount },
    conceptsCovered,
    wentWell,
  };
}

// Compact, prompt-friendly text version of a completed lesson — fed to the next-lesson
// brief generator so it knows what the first lesson addressed and how the learner did.
export function formatFirstLessonReport(results: LessonResults): string {
  const lines: string[] = [];
  lines.push(`Lesson completed: "${results.lessonTitle}"`);
  if (results.score != null) lines.push(`Overall score: ${results.score}/100 across ${results.responseCount} graded responses.`);
  if (results.durationSec != null) lines.push(`Time to finish: ${Math.round(results.durationSec / 60)} min.`);
  if (results.avgRecallSec != null) {
    lines.push(`Average time to start speaking: ${results.avgRecallSec}s${results.avgWpm != null ? `; average pace ${results.avgWpm} wpm` : ''}.`);
  }
  if (results.conceptsCovered.length) lines.push(`Concepts practiced: ${results.conceptsCovered.join('; ')}.`);
  if (results.wentWell.length) lines.push(`Went well: ${results.wentWell.join('; ')}.`);
  lines.push(`Mistakes (${results.mistakeCounts.total} total: ${results.mistakeCounts.new} new, ${results.mistakeCounts.recurring} recurring):`);
  if (results.mistakes.length === 0) {
    lines.push('  - None notable.');
  } else {
    for (const m of results.mistakes.slice(0, 12)) {
      const said = m.youSaid ? ` | said: "${m.youSaid}"` : '';
      const tgt = m.target ? ` → target: "${m.target}"` : '';
      lines.push(`  - [${m.category}] ${m.description}${said}${tgt}`);
    }
  }
  return lines.join('\n');
}
