import type { DeckDirectionSetting, VocabCard, VocabDeck, VocabNote } from '@/lib/types';
import { allowedDirections, buildQueue, countsByState, todaysLog, DEFAULT_SRS_CONFIG } from '@/lib/srs';
import { computeRetention, dueForecast, estimateMinutes } from '@/lib/vocab-stats';
import { readStore, writeStore, readReviewLog } from './store';

// GET /api/vocab?user=NAME[&queue=all|<deckId>] — home payload (+ session queue).
// POST /api/vocab { user, op: 'setup'|'deck-direction', ... } — small store updates.

export interface SessionCard {
  card: VocabCard;
  note: VocabNote;
  deckId: string;
  deckName: string;
}

// Cards a deck's direction setting currently allows.
function activeCards(deck: VocabDeck): VocabCard[] {
  const dirs = allowedDirections(deck.direction);
  return deck.cards.filter((c) => dirs.includes(c.direction));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = url.searchParams.get('user');
  const queueScope = url.searchParams.get('queue');
  if (!user) return Response.json({ error: 'missing_user' }, { status: 400 });

  const store = readStore(user);
  const log = readReviewLog(user);
  const now = new Date();

  const decks = store.decks.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    source: d.source,
    direction: d.direction,
    noteCount: d.notes.length,
    counts: countsByState(activeCards(d), now),
  }));

  const allActive = store.decks.flatMap(activeCards);
  const totalsRaw = countsByState(allActive, now);
  const totals = {
    ...totalsRaw,
    estMinutes: estimateMinutes(
      Math.min(totalsRaw.newCount, DEFAULT_SRS_CONFIG.newPerDay) + totalsRaw.learning + totalsRaw.due,
    ),
  };

  const payload: Record<string, unknown> = {
    setupCompleted: store.setupCompleted,
    decks,
    totals,
    forecast: dueForecast(allActive, now),
    retention: computeRetention(log, now),
  };

  if (queueScope) {
    const scoped = queueScope === 'all' ? store.decks : store.decks.filter((d) => d.id === queueScope);
    const noteById = new Map<string, { note: VocabNote; deckId: string; deckName: string }>();
    for (const d of scoped) for (const n of d.notes) noteById.set(n.id, { note: n, deckId: d.id, deckName: d.name });
    const cards = scoped.flatMap(activeCards);
    const queue = buildQueue(cards, now, DEFAULT_SRS_CONFIG, todaysLog(log, now));
    payload.queue = queue
      .map((card) => {
        const meta = noteById.get(card.noteId);
        return meta ? { card, note: meta.note, deckId: meta.deckId, deckName: meta.deckName } : null;
      })
      .filter((x): x is SessionCard => x !== null);
  }

  return Response.json(payload);
}

export async function POST(req: Request) {
  let body: { user?: string; op?: string; method?: 'auto' | 'upload'; deckId?: string; direction?: DeckDirectionSetting };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const { user, op } = body;
  if (!user || !op) return Response.json({ error: 'missing_fields' }, { status: 400 });

  const store = readStore(user);

  if (op === 'setup') {
    store.setupCompleted = true;
    if (body.method) store.setupMethod = body.method;
    writeStore(user, store);
    return Response.json({ ok: true });
  }

  if (op === 'deck-direction') {
    const deck = store.decks.find((d) => d.id === body.deckId);
    if (!deck) return Response.json({ error: 'deck_not_found' }, { status: 404 });
    if (!['both', 'recognize', 'recall'].includes(body.direction ?? '')) {
      return Response.json({ error: 'bad_direction' }, { status: 400 });
    }
    deck.direction = body.direction!;
    writeStore(user, store);
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'unknown_op' }, { status: 400 });
}
