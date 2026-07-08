import fs from 'fs';
import path from 'path';
import type { VocabReviewRecord, VocabStore } from '@/lib/types';

// Shared persistence helpers for the vocab API routes (not a route itself).
// Store: data/vocab/[safeName].json (read-modify-write, like lesson/history).
// Review log: data/vocab-reviews/[safeName].jsonl (append-only, like lesson/activity).

const VOCAB_DIR = path.join(process.cwd(), 'data', 'vocab');
const REVIEWS_DIR = path.join(process.cwd(), 'data', 'vocab-reviews');

export function safeName(name: string): string {
  return (name || 'student').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'student';
}

export function emptyStore(): VocabStore {
  return { version: 1, setupCompleted: false, decks: [] };
}

export function readStore(user: string): VocabStore {
  try {
    return JSON.parse(fs.readFileSync(path.join(VOCAB_DIR, `${safeName(user)}.json`), 'utf8'));
  } catch {
    return emptyStore();
  }
}

export function writeStore(user: string, store: VocabStore): void {
  fs.mkdirSync(VOCAB_DIR, { recursive: true });
  fs.writeFileSync(path.join(VOCAB_DIR, `${safeName(user)}.json`), JSON.stringify(store, null, 2));
}

export function readReviewLog(user: string): VocabReviewRecord[] {
  try {
    const raw = fs.readFileSync(path.join(REVIEWS_DIR, `${safeName(user)}.jsonl`), 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line) as VocabReviewRecord; } catch { return null; } })
      .filter((r): r is VocabReviewRecord => r !== null);
  } catch {
    return [];
  }
}

export function appendReview(user: string, record: VocabReviewRecord): void {
  fs.mkdirSync(REVIEWS_DIR, { recursive: true });
  fs.appendFileSync(path.join(REVIEWS_DIR, `${safeName(user)}.jsonl`), JSON.stringify(record) + '\n');
}

// Stable note id from the Spanish text (+ dedupe suffix handled by callers if needed).
export function noteIdFor(es: string, existing: Set<string>): string {
  const base = es.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'note';
  let id = base;
  let n = 2;
  while (existing.has(id)) id = `${base}-${n++}`;
  existing.add(id);
  return id;
}
