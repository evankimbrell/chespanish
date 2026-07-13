import path from 'path';

// Single source of truth for where the app persists data. Everything the server
// writes at runtime lives under DATA_DIR so production can point it at a mounted
// volume (DATA_DIR=/data on Fly.io) while dev keeps using <repo>/data. This is
// also the seam the future Supabase migration replaces.
//
// Generated media (lesson mp3s, vocab images, test audio) lives here too — NOT in
// public/ — because Next's standalone server only serves the public/ copy taken at
// build time; runtime writes to public/ are never served. The URL shapes are
// preserved by route handlers in src/app/{lessons,vocab-images,test-audio}/[file]/.

export function resolveDataDir(env: Record<string, string | undefined> = process.env): string {
  const v = env.DATA_DIR?.trim();
  return v ? path.resolve(v) : path.join(process.cwd(), 'data');
}

export const DATA_DIR = resolveDataDir();

export const ACTIVITY_DIR = path.join(DATA_DIR, 'activity');
export const LESSONS_DIR = path.join(DATA_DIR, 'lessons');
export const NEXT_BRIEFS_DIR = path.join(DATA_DIR, 'next-briefs');
export const REPORTS_DIR = path.join(DATA_DIR, 'reports');
export const TEST_RUNS_DIR = path.join(DATA_DIR, 'test-runs');
export const VOCAB_DIR = path.join(DATA_DIR, 'vocab');
export const VOCAB_REVIEWS_DIR = path.join(DATA_DIR, 'vocab-reviews');

export const MEDIA_LESSONS_DIR = path.join(DATA_DIR, 'media', 'lessons');
export const MEDIA_VOCAB_IMAGES_DIR = path.join(DATA_DIR, 'media', 'vocab-images');
export const MEDIA_TEST_AUDIO_DIR = path.join(DATA_DIR, 'media', 'test-audio');
// Pre-generated vocab card audio, content-addressed (sha1 of voice+text) so decks
// sharing words share files and regeneration is a no-op.
export const MEDIA_VOCAB_AUDIO_DIR = path.join(DATA_DIR, 'media', 'vocab-audio');
