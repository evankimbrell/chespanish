import type { VocabDeck, VocabNote } from '@/lib/types';
import { parseDeckFile } from '@/lib/vocab-import';
import { createCardsForNote } from '@/lib/srs';
import { readStore, writeStore, noteIdFor } from '../store';

// POST /api/vocab/import { user, filename, content, deckName? } — CSV/TXT only
// (.apkg deferred). The client reads the file as text (FileReader) and sends it inline.

export async function POST(req: Request) {
  let body: { user?: string; filename?: string; content?: string; deckName?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const { user, filename, content } = body;
  if (!user || !filename || typeof content !== 'string') {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }

  const { notes: parsed, errors } = parseDeckFile(content, filename);
  if (parsed.length === 0) {
    return Response.json({ error: 'no_notes_parsed', errors }, { status: 400 });
  }

  const store = readStore(user);
  const now = new Date();
  const existingIds = new Set(store.decks.flatMap((d) => d.notes.map((n) => n.id)));

  const notes: VocabNote[] = parsed.map((p) => ({
    id: noteIdFor(p.es, existingIds),
    es: p.es,
    en: p.en,
    example: p.example,
    exampleEn: p.exampleEn,
    tags: p.tags,
  }));

  const deck: VocabDeck = {
    id: `user-${Date.now()}`,
    name: body.deckName?.trim() || filename.replace(/\.(csv|txt)$/i, ''),
    description: `Imported from ${filename}`,
    source: 'Uploaded',
    direction: 'both',
    createdAt: now.toISOString(),
    notes,
    cards: notes.flatMap((n) => createCardsForNote(n.id, now)),
  };

  store.decks.push(deck);
  store.setupCompleted = true;
  store.setupMethod = store.setupMethod ?? 'upload';
  writeStore(user, store);

  return Response.json({
    deckId: deck.id,
    noteCount: notes.length,
    sample: notes.slice(0, 3).map((n) => `${n.es} — ${n.en}`),
    errors,
  });
}
