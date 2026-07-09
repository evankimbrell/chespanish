import fs from 'fs';
import path from 'path';
import type { LessonActivityRecord } from '@/lib/types';
import { aggregateMistakes, formatMistakeForPrompt } from '@/lib/common-mistakes';
import { generatePracticeLesson } from '@/lib/lesson-design';
import * as dp from '@/lib/data-paths';

export const maxDuration = 60; // single model call to draft a short transcript

const ACTIVITY_DIR = dp.ACTIVITY_DIR;
const REPORTS_DIR = dp.REPORTS_DIR;

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

// Best-effort level from the latest stored level-test report.
function readLevel(user: string): string | null {
  try {
    const prefix = `${safeName(user)}-`;
    const file = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.json') && f.startsWith(prefix)).sort().at(-1);
    if (!file) return null;
    const report = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
    return report?.testReport?.display_level ?? null;
  } catch { return null; }
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  let body: { user?: string; mistakeId?: string; level?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const { user, mistakeId } = body;
  if (!user || !mistakeId) return Response.json({ error: 'missing_params' }, { status: 400 });

  const mistake = aggregateMistakes(readActivity(user)).find((m) => m.id === mistakeId);
  if (!mistake) return Response.json({ error: 'mistake_not_found' }, { status: 404 });

  const level = body.level || readLevel(user) || 'B1';

  try {
    const block = formatMistakeForPrompt(mistake, level);
    const transcript = await generatePracticeLesson(block);
    if (!transcript) return Response.json({ error: 'generation_failed' }, { status: 502 });
    return Response.json({ transcript, title: `Targeted practice · ${mistake.name}` });
  } catch (e) {
    console.error('[mistakes/practice] error:', e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
