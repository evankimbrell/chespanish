import fs from 'fs';
import path from 'path';
import type { LessonActivityRecord, LessonHistoryEntry } from '@/lib/types';
import { summarizeLessonResults, formatFirstLessonReport } from '@/lib/lesson-results';
import { condenseLevelTestReport, buildCombinedReport } from '@/lib/next-lesson-brief';
import { generateNextLessonBrief } from '@/lib/lesson-design';
import type { DisplayLesson } from '@/lib/lesson-design';

export const maxDuration = 60; // brief generation is a single model call

const ACTIVITY_DIR = path.join(process.cwd(), 'data', 'activity');
const LESSONS_DIR = path.join(process.cwd(), 'data', 'lessons');
const REPORTS_DIR = path.join(process.cwd(), 'data', 'reports');
const CACHE_DIR = path.join(process.cwd(), 'data', 'next-briefs');

function safeName(name: string): string {
  return (name || 'student').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'student';
}

function readActivity(user: string): LessonActivityRecord[] {
  try {
    const raw = fs.readFileSync(path.join(ACTIVITY_DIR, `${safeName(user)}.jsonl`), 'utf8');
    return raw.split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as LessonActivityRecord; } catch { return null; } })
      .filter((r): r is LessonActivityRecord => r !== null);
  } catch { return []; }
}

function readHistoryEntry(user: string, lessonId: string): LessonHistoryEntry | undefined {
  try {
    const entries: LessonHistoryEntry[] = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, `${safeName(user)}.json`), 'utf8'));
    return entries.find((e) => e.id === lessonId);
  } catch { return undefined; }
}

// Most recent stored level-test report for the user.
function readLatestReport(user: string): { testReport?: unknown; educatorReport?: string } | null {
  try {
    const prefix = `${safeName(user)}-`;
    const file = fs.readdirSync(REPORTS_DIR)
      .filter((f) => f.endsWith('.json') && f.startsWith(prefix))
      .sort()
      .at(-1);
    if (!file) return null;
    return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
  } catch { return null; }
}

export async function GET(req: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user');
  const lessonId = searchParams.get('lessonId');
  const refresh = searchParams.get('refresh') === '1';
  if (!user || !lessonId) return Response.json({ error: 'missing_params' }, { status: 400 });

  const cacheFile = path.join(CACHE_DIR, `${safeName(user)}-${safeName(lessonId)}.json`);
  if (!refresh) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached?.brief) return Response.json({ brief: cached.brief, cached: true });
    } catch { /* no cache yet */ }
  }

  try {
    const results = summarizeLessonResults({ lessonId, records: readActivity(user), history: readHistoryEntry(user, lessonId) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const condensed = condenseLevelTestReport(readLatestReport(user) as any);
    const combined = buildCombinedReport(condensed, formatFirstLessonReport(results));

    const { fullBrief, displayLesson } = await generateNextLessonBrief(combined);

    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify({ brief: displayLesson, fullBrief, generatedAt: new Date().toISOString() }, null, 2));
    } catch (e) { console.error('[lesson/next-brief] cache write failed:', e); }

    const brief: DisplayLesson = displayLesson;
    return Response.json({ brief });
  } catch (e) {
    console.error('[lesson/next-brief] error:', e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
