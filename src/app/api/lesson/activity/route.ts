import fs from 'fs';
import path from 'path';
import type { LessonActivityRecord } from '@/lib/types';
import * as dp from '@/lib/data-paths';

// Per-user, append-only activity log of in-lesson responses and questions.
// Stored as JSONL (one JSON record per line) so concurrent appends never clobber
// each other (no read-modify-write) and the file grows cheaply.
const ACTIVITY_DIR = dp.ACTIVITY_DIR;

function safeName(name: string): string {
  return (name || 'student').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'student';
}

export async function POST(req: Request) {
  let body: { userName?: string; record?: LessonActivityRecord };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { userName, record } = body;
  if (!userName || !record || (record.type !== 'response' && record.type !== 'question')) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }

  try {
    fs.mkdirSync(ACTIVITY_DIR, { recursive: true });
    const file = path.join(ACTIVITY_DIR, `${safeName(userName)}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(record) + '\n');
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[lesson/activity] write failed:', e);
    return Response.json({ error: 'write_failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const userName = new URL(req.url).searchParams.get('user');
  if (!userName) return Response.json({ error: 'missing_user' }, { status: 400 });
  const file = path.join(ACTIVITY_DIR, `${safeName(userName)}.jsonl`);
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const records = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line) as LessonActivityRecord; } catch { return null; } })
      .filter((r): r is LessonActivityRecord => r !== null);
    return Response.json({ records });
  } catch {
    return Response.json({ records: [] });
  }
}
