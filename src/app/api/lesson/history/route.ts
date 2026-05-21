import fs from 'fs';
import path from 'path';
import type { LessonHistoryEntry } from '@/lib/types';

const DIR = path.join(process.cwd(), 'data/lessons');

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function filePath(userName: string) {
  return path.join(DIR, `${safeName(userName)}.json`);
}

function readEntries(userName: string): LessonHistoryEntry[] {
  try {
    return JSON.parse(fs.readFileSync(filePath(userName), 'utf8'));
  } catch {
    return [];
  }
}

function writeEntries(userName: string, entries: LessonHistoryEntry[]) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(filePath(userName), JSON.stringify(entries, null, 2));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user');
  if (!user) return Response.json({ entries: [] });

  const entries = readEntries(user).sort(
    (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
  );
  return Response.json({ entries });
}

export async function POST(req: Request) {
  const { userName, entry }: { userName: string; entry: LessonHistoryEntry } = await req.json();
  if (!userName || !entry?.id) return Response.json({ ok: false }, { status: 400 });

  const entries = readEntries(userName);
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...entry };
  } else {
    entries.unshift(entry);
  }
  writeEntries(userName, entries);
  return Response.json({ ok: true });
}
