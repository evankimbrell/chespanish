import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { ElevenLabsClient } from 'elevenlabs';
import type { VocabDeck } from './types';
import { SPANISH_MALE_VOICE_ID } from './voices';
import { MEDIA_VOCAB_AUDIO_DIR } from './data-paths';

// Pre-generated audio for vocab cards. Without this, every play press is a live
// ElevenLabs round trip (5-10s felt latency); with it, cards play an mp3 straight
// off the volume. Files are content-addressed by sha1(voice|text) so identical
// words across decks/users share one file and re-runs skip everything present.

const VOICE = SPANISH_MALE_VOICE_ID;
const CONCURRENCY = 3;

export function vocabAudioFileName(text: string, voiceId: string = VOICE): string {
  return `${createHash('sha1').update(`${voiceId}|${text.trim()}`).digest('hex')}.mp3`;
}

function fileFor(text: string): string {
  return path.join(MEDIA_VOCAB_AUDIO_DIR, vocabAudioFileName(text));
}

// The spoken texts a note carries: the Spanish word itself + its example sentence.
export function noteTexts(note: { es: string; example?: string }): string[] {
  const texts = [note.es.trim()].filter(Boolean);
  if (note.example?.trim()) texts.push(note.example.trim());
  return texts;
}

// URL served by src/app/vocab-audio/[file]/route.ts — null until the file exists,
// so clients fall back to live TTS for not-yet-generated cards.
export function audioUrlFor(text: string | undefined): string | null {
  if (!text?.trim()) return null;
  return fs.existsSync(fileFor(text)) ? `/vocab-audio/${vocabAudioFileName(text)}` : null;
}

export function deckAudioStatus(deck: VocabDeck): { total: number; ready: number } {
  const texts = new Set(deck.notes.flatMap(noteTexts));
  let ready = 0;
  for (const t of texts) if (fs.existsSync(fileFor(t))) ready++;
  return { total: texts.size, ready };
}

// ── Generation ────────────────────────────────────────────────────────────────

let _client: ElevenLabsClient | null = null;
function getClient(): ElevenLabsClient {
  if (!_client) _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
  return _client;
}

async function synthesize(text: string): Promise<Buffer> {
  const stream = await getClient().textToSpeech.convertAsStream(VOICE, {
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
  });
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

// One generation loop per user:deck at a time; repeated kicks while running are
// no-ops (the client re-kicks on every deck open to resume interrupted runs).
const running = new Set<string>();

export function isGenerating(user: string, deckId: string): boolean {
  return running.has(`${user}:${deckId}`);
}

// Fire-and-forget from route handlers — fine on our long-running server (Fly
// machine stays up; a deploy interrupts it and the next deck open resumes).
export async function generateDeckAudio(user: string, deck: VocabDeck): Promise<void> {
  const key = `${user}:${deck.id}`;
  if (running.has(key)) return;
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('[vocab-audio] ELEVENLABS_API_KEY missing — skipping generation');
    return;
  }
  running.add(key);
  try {
    fs.mkdirSync(MEDIA_VOCAB_AUDIO_DIR, { recursive: true });
    const texts = [...new Set(deck.notes.flatMap(noteTexts))].filter((t) => !fs.existsSync(fileFor(t)));
    if (texts.length === 0) return;
    console.log(`[vocab-audio] ${key}: generating ${texts.length} clips`);
    let done = 0;
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      await Promise.all(texts.slice(i, i + CONCURRENCY).map(async (text) => {
        try {
          const buf = await synthesize(text);
          // Write via tmp+rename so a crash mid-write can't leave a partial mp3
          // that the media route would happily serve.
          const target = fileFor(text);
          const tmp = `${target}.tmp-${process.pid}`;
          fs.writeFileSync(tmp, buf);
          fs.renameSync(tmp, target);
          done++;
        } catch (e) {
          console.error(`[vocab-audio] failed for "${text.slice(0, 40)}":`, e instanceof Error ? e.message : e);
        }
      }));
    }
    console.log(`[vocab-audio] ${key}: done (${done}/${texts.length})`);
  } finally {
    running.delete(key);
  }
}
