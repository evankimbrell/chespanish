import fs from 'fs';
import path from 'path';
import type { LessonActivityRecord } from '@/lib/types';
import { aggregateMistakes } from '@/lib/common-mistakes';
import * as dp from '@/lib/data-paths';

const ACTIVITY_DIR = dp.ACTIVITY_DIR;

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

export async function GET(req: Request) {
  const user = new URL(req.url).searchParams.get('user');
  if (!user) return Response.json({ error: 'missing_user' }, { status: 400 });

  const records = readActivity(user);
  const mistakes = aggregateMistakes(records);
  const lessonsCount = new Set(
    records.filter((r) => r.lessonId).map((r) => r.lessonId),
  ).size;

  return Response.json({ mistakes, lessonsCount });
}
