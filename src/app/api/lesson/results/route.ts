import fs from 'fs';
import path from 'path';
import type { LessonActivityRecord, LessonHistoryEntry } from '@/lib/types';
import { summarizeLessonResults } from '@/lib/lesson-results';
import * as dp from '@/lib/data-paths';

const ACTIVITY_DIR = dp.ACTIVITY_DIR;
const LESSONS_DIR = dp.LESSONS_DIR;

function safeName(name: string): string {
  return (name || 'student').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'student';
}

function readActivity(user: string): LessonActivityRecord[] {
  try {
    const raw = fs.readFileSync(path.join(ACTIVITY_DIR, `${safeName(user)}.jsonl`), 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as LessonActivityRecord; } catch { return null; } })
      .filter((r): r is LessonActivityRecord => r !== null);
  } catch {
    return [];
  }
}

function readHistoryEntry(user: string, lessonId: string): LessonHistoryEntry | undefined {
  try {
    const entries: LessonHistoryEntry[] = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, `${safeName(user)}.json`), 'utf8'));
    return entries.find((e) => e.id === lessonId);
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user');
  const lessonId = searchParams.get('lessonId');
  const fallbackTitle = searchParams.get('title') || undefined;
  if (!user || !lessonId) return Response.json({ error: 'missing_params' }, { status: 400 });

  const results = summarizeLessonResults({
    lessonId,
    records: readActivity(user),
    history: readHistoryEntry(user, lessonId),
    fallbackTitle,
  });
  return Response.json({ results });
}
