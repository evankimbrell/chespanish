import type { VocabGrade, VocabReviewRecord } from '@/lib/types';
import { scheduleCard } from '@/lib/srs';
import { readStore, writeStore, appendReview } from '../store';

// POST /api/vocab/review — grade one card. Server-authoritative: the server computes
// `now` and runs the SM-2 transition, so client clock skew can't corrupt scheduling.
// Persists the updated card (store rewrite) + one JSONL log line, returns the card.

const GRADES: VocabGrade[] = ['again', 'hard', 'good', 'easy'];

export async function POST(req: Request) {
  let body: {
    user?: string; deckId?: string; cardId?: string; grade?: VocabGrade;
    heard?: string; verdict?: 'match' | 'no_match'; tookMs?: number;
  };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const { user, deckId, cardId, grade } = body;
  if (!user || !deckId || !cardId || !grade) return Response.json({ error: 'missing_fields' }, { status: 400 });
  if (!GRADES.includes(grade)) return Response.json({ error: 'bad_grade' }, { status: 400 });

  const store = readStore(user);
  const deck = store.decks.find((d) => d.id === deckId);
  const idx = deck?.cards.findIndex((c) => c.id === cardId) ?? -1;
  if (!deck || idx < 0) return Response.json({ error: 'card_not_found' }, { status: 404 });

  const prev = deck.cards[idx];
  const now = new Date();
  const updated = scheduleCard(prev, grade, now);
  deck.cards[idx] = updated;
  writeStore(user, store);

  const record: VocabReviewRecord = {
    at: now.toISOString(),
    deckId,
    cardId,
    noteId: prev.noteId,
    direction: prev.direction,
    grade,
    prevState: prev.state,
    prevIntervalDays: prev.intervalDays,
    newState: updated.state,
    newIntervalDays: updated.intervalDays,
    newDue: updated.due,
    ...(body.heard ? { heard: body.heard } : {}),
    ...(body.verdict ? { verdict: body.verdict } : {}),
    ...(typeof body.tookMs === 'number' ? { tookMs: body.tookMs } : {}),
  };
  appendReview(user, record);

  return Response.json({ card: updated });
}
