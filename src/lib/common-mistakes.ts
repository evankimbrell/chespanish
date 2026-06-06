import type { LessonActivityRecord } from './types';

// A curated list of common Argentine-Spanish mistakes. The learner's logged errors are
// matched against this so the Mistakes page can flag known patterns with nice names,
// frequency, and last-seen — and so a targeted practice lesson can be generated.

export type Severity = 'high' | 'med' | 'low';

export interface CommonMistakeDef {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  target?: string;       // the correct form
  commonWrong?: string;  // the typical wrong form
  blurb: string;         // short explanation, seeds the practice lesson
  categories: string[];  // observed_error categories (lowercased) that map here
  keywords: string[];    // lowercased substrings to look for in the error/answer
}

export const COMMON_MISTAKE_CATALOG: CommonMistakeDef[] = [
  {
    id: 'vos-conjugation', name: 'Vos: tenés / querés / podés', category: 'Conjugation', severity: 'high',
    target: 'tenés', commonWrong: 'tienes',
    blurb: 'Argentine Spanish uses the vos conjugation — tenés, querés, podés, sos — not the tú forms tienes, quieres, puedes, eres.',
    categories: ['conjugation'],
    keywords: ['tenés', 'tienes', 'querés', 'quieres', 'podés', 'puedes', ' vos ', 'sos', 'eres', 'vos conjugation', 'tú form', 'tu form'],
  },
  {
    id: 'object-pronouns', name: 'Object pronouns: lo / la / me / te', category: 'Grammar', severity: 'med',
    blurb: 'Direct and indirect object pronouns (lo, la, me, te, le) and where they attach to the verb.',
    categories: [], keywords: ['object pronoun', 'pronoun', 'clitic', 'lo/la', 'me/te'],
  },
  {
    id: 'past-tense', name: 'Past endings (pretérito vs imperfecto)', category: 'Tense', severity: 'med',
    blurb: 'Choosing between the preterite (completed actions) and the imperfect (ongoing/background) in the past.',
    categories: ['tense'], keywords: ['pretérito', 'preterite', 'imperfecto', 'imperfect', 'past tense', 'past ending', 'past form'],
  },
  {
    id: 'listening-fast', name: 'Mishearing fast casual phrases', category: 'Listening', severity: 'med',
    blurb: 'Catching fast, run-together casual Rioplatense phrases without losing the thread.',
    categories: ['listening', 'comprehension'], keywords: ['misheard', 'mishear', 'did not catch', 'didn’t catch', "didn't catch", 'listening', 'comprehension'],
  },
  {
    id: 'deseo-quiero', name: '"Deseo" instead of "quiero"', category: 'Naturalness', severity: 'low',
    target: 'quiero', commonWrong: 'deseo',
    blurb: 'Using overly formal words like "deseo" where a natural speaker just says "quiero".',
    categories: ['naturalness', 'register'], keywords: ['deseo', 'overformal', 'too formal', 'overly formal', 'unnatural', 'register'],
  },
  {
    id: 'ser-estar', name: 'Ser vs estar', category: 'Grammar', severity: 'med',
    blurb: 'Choosing between ser (identity/permanence) and estar (states/location/feelings).',
    categories: [], keywords: ['ser vs estar', 'ser/estar', 'estar instead', 'ser instead', 'use of ser', 'use of estar'],
  },
  {
    id: 'por-para', name: 'Por vs para', category: 'Grammar', severity: 'low',
    blurb: 'Choosing between por and para.',
    categories: [], keywords: ['por vs para', 'por/para', 'por instead', 'para instead'],
  },
  {
    id: 'gender-agreement', name: 'Gender / adjective agreement', category: 'Grammar', severity: 'low',
    blurb: 'Matching article and adjective gender and number to the noun.',
    categories: ['agreement'], keywords: ['gender agreement', 'agreement', 'concordancia', 'masculine/feminine'],
  },
];

export interface MistakeExample {
  youSaid: string;
  target?: string;
  description?: string;
  at: string;
  lessonTitle?: string;
}

export interface MistakeSummary {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  target?: string;
  commonWrong?: string;
  blurb: string;
  count: number;
  lastSeenAt: string | null;
  examples: MistakeExample[];
}

const LABEL_SEV: Record<string, Severity> = { Ouch: 'high', Almost: 'med', Ok: 'low', Good: 'low', Excellent: 'low' };
const SLOW_RESPONSE_SEC = 4; // lead-in longer than this counts as a slow response
const MAX_EXAMPLES = 8;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other';
}

export function aggregateMistakes(records: LessonActivityRecord[]): MistakeSummary[] {
  const buckets = new Map<string, MistakeSummary>();

  const get = (key: string, init: Omit<MistakeSummary, 'count' | 'lastSeenAt' | 'examples'>): MistakeSummary => {
    let b = buckets.get(key);
    if (!b) { b = { ...init, count: 0, lastSeenAt: null, examples: [] }; buckets.set(key, b); }
    return b;
  };
  const record = (b: MistakeSummary, at: string, ex: MistakeExample) => {
    b.count += 1;
    if (!b.lastSeenAt || new Date(at).getTime() > new Date(b.lastSeenAt).getTime()) b.lastSeenAt = at;
    b.examples.push(ex);
  };

  for (const r of records) {
    if (r.type !== 'response') continue;
    const youSaid = r.transcript;
    const target = r.grade?.correct_answer || r.grade?.suggested_answer || r.expected;
    const lessonTitle = r.lessonTitle;

    for (const e of r.grade?.observed_errors ?? []) {
      // Match on the grader's stated error only (category + description). Including the
      // full transcript/answer caused false matches (e.g. a Vocabulary error on a
      // sentence that merely contains "tenés" getting tagged as a conjugation mistake).
      const hay = `${e.category} ${e.description}`.toLowerCase();
      const def = COMMON_MISTAKE_CATALOG.find(
        (d) => d.keywords.some((k) => hay.includes(k)) || d.categories.includes(e.category.toLowerCase()),
      );
      const b = def
        ? get(def.id, { id: def.id, name: def.name, category: def.category, severity: def.severity, target: def.target, commonWrong: def.commonWrong, blurb: def.blurb })
        : get(`cat:${e.category.toLowerCase()}`, { id: `cat-${slug(e.category)}`, name: e.category, category: e.category, severity: LABEL_SEV[r.grade?.label ?? ''] ?? 'low', blurb: `Recurring ${e.category.toLowerCase()} issues across your lessons.` });
      record(b, r.at, { youSaid, target, description: e.description, at: r.at, lessonTitle });
    }

    if (r.timing?.initialSilenceSec != null && r.timing.initialSilenceSec >= SLOW_RESPONSE_SEC) {
      const b = get('slow-response', { id: 'slow-response', name: 'Slow responses to direct questions', category: 'Speed', severity: 'high', blurb: 'Taking a long time to start speaking after a prompt — this lesson builds automaticity so answers come faster.' });
      record(b, r.at, { youSaid, target, description: `Took ${r.timing.initialSilenceSec}s to start speaking.`, at: r.at, lessonTitle });
    }
  }

  const list = [...buckets.values()];
  for (const b of list) {
    b.examples.sort((a, c) => new Date(c.at).getTime() - new Date(a.at).getTime());
    b.examples = b.examples.slice(0, MAX_EXAMPLES);
  }
  return list.sort((a, b) => b.count - a.count);
}

// Compact data block describing one mistake (+ the learner's real examples) for the
// targeted practice-lesson prompt.
export function formatMistakeForPrompt(m: MistakeSummary, level: string): string {
  const lines: string[] = [];
  lines.push(`Student level: ${level}`);
  lines.push(`Mistake to fix: ${m.name} (category: ${m.category}).`);
  lines.push(`What it is: ${m.blurb}`);
  if (m.commonWrong || m.target) lines.push(`Typical error: ${m.commonWrong ?? '—'} → correct: ${m.target ?? '—'}.`);
  lines.push(`Seen ${m.count} time(s) in their lessons.`);
  lines.push('Real examples from the student’s own responses:');
  if (m.examples.length === 0) {
    lines.push('  - (no specific transcript examples recorded)');
  } else {
    for (const ex of m.examples.slice(0, 6)) {
      const said = ex.youSaid ? `said: "${ex.youSaid}"` : '';
      const tgt = ex.target ? ` → target: "${ex.target}"` : '';
      const desc = ex.description ? ` (${ex.description})` : '';
      lines.push(`  - ${said}${tgt}${desc}`);
    }
  }
  return lines.join('\n');
}
