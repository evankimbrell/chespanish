import fs from 'fs';
import path from 'path';
import { readStore, writeStore, safeName } from '../store';

// POST /api/vocab/image (FormData: user, deckId, noteId, image) — user-fillable card
// images, saved under public/vocab-images/. NOTE: files added to public/ after `next
// build` may not be served by `next start` on some hosts; if that bites in production,
// switch to serving via a GET route that reads the file.

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const fd = await req.formData();
  const user = fd.get('user') as string | null;
  const deckId = fd.get('deckId') as string | null;
  const noteId = fd.get('noteId') as string | null;
  const image = fd.get('image') as File | null;
  if (!user || !deckId || !noteId || !image) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }

  const ext = ALLOWED[image.type];
  if (!ext) return Response.json({ error: 'unsupported_type' }, { status: 400 });
  if (image.size > MAX_BYTES) return Response.json({ error: 'too_large' }, { status: 400 });

  const store = readStore(user);
  const deck = store.decks.find((d) => d.id === deckId);
  const note = deck?.notes.find((n) => n.id === noteId);
  if (!note) return Response.json({ error: 'note_not_found' }, { status: 404 });

  const dir = path.join(process.cwd(), 'public', 'vocab-images');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${safeName(user)}-${noteId}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), Buffer.from(await image.arrayBuffer()));

  note.imageUrl = `/vocab-images/${filename}`;
  writeStore(user, store);

  return Response.json({ imageUrl: note.imageUrl });
}
