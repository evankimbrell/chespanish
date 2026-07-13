import { readStore } from '../store';
import { deckAudioStatus, generateDeckAudio, isGenerating } from '@/lib/vocab-audio';

// GET  /api/vocab/audio?user=X&deckId=Y|all — readiness {total, ready, generating}
// POST /api/vocab/audio { user, deckId|'all' } — (re)kick generation, fire-and-forget,
//      returns the same status. The review page kicks on open so interrupted runs
//      (deploys, restarts) resume the moment anyone looks at the deck.

function statusFor(user: string, deckId: string) {
  const store = readStore(user);
  const decks = deckId === 'all' ? store.decks : store.decks.filter((d) => d.id === deckId);
  let total = 0;
  let ready = 0;
  let generating = false;
  for (const d of decks) {
    const s = deckAudioStatus(d);
    total += s.total;
    ready += s.ready;
    if (isGenerating(user, d.id)) generating = true;
  }
  return { total, ready, generating, decks: decks.length };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = url.searchParams.get('user');
  const deckId = url.searchParams.get('deckId') ?? 'all';
  if (!user) return Response.json({ error: 'missing_user' }, { status: 400 });
  return Response.json(statusFor(user, deckId));
}

export async function POST(req: Request) {
  let body: { user?: string; deckId?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const { user, deckId = 'all' } = body;
  if (!user) return Response.json({ error: 'missing_user' }, { status: 400 });

  const store = readStore(user);
  const decks = deckId === 'all' ? store.decks : store.decks.filter((d) => d.id === deckId);
  for (const d of decks) void generateDeckAudio(user, d);

  return Response.json(statusFor(user, deckId));
}
