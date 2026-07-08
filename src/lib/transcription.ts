import OpenAI from 'openai';
import type { WordTiming } from './types';

// Provider-agnostic speech-to-text. Two backends:
//  - 'whisper'    — OpenAI whisper-1 (current default)
//  - 'elevenlabs' — ElevenLabs Scribe (scribe_v1), reportedly more verbatim
// Select globally with TRANSCRIBE_PROVIDER=elevenlabs, or per call (the benchmark
// endpoint runs both). ElevenLabs failures fall back to Whisper so a provider outage
// can never break lessons.

export type TranscriptionProvider = 'whisper' | 'elevenlabs';

export interface TranscriptionResult {
  text: string;
  words: WordTiming[];
  durationSec: number;
  provider: TranscriptionProvider;
  latencyMs: number;
  detectedLanguage?: string;
}

export function resolveProvider(explicit?: string | null): TranscriptionProvider {
  const v = (explicit ?? process.env.TRANSCRIBE_PROVIDER ?? 'whisper').toLowerCase().trim();
  return v === 'elevenlabs' ? 'elevenlabs' : 'whisper';
}

// ── ElevenLabs Scribe ────────────────────────────────────────────────────────

// Scribe's words array mixes entries: type 'word' (spoken), 'spacing' (gaps), and
// 'audio_event' (laughter etc). Only 'word' entries become WordTimings.
export interface ScribeWord {
  text: string;
  start?: number;
  end?: number;
  type?: string;
}

export function scribeWordsToTimings(words: ScribeWord[] | null | undefined): WordTiming[] {
  if (!Array.isArray(words)) return [];
  return words
    .filter((w) => (w.type ?? 'word') === 'word' && typeof w.start === 'number' && typeof w.end === 'number' && w.text?.trim())
    .map((w) => ({ word: w.text.trim(), start: w.start!, end: w.end! }));
}

// Scribe has no top-level audio duration; the last timestamped entry (including
// trailing spacing) is the closest available estimate.
export function scribeDurationSec(words: ScribeWord[] | null | undefined): number {
  if (!Array.isArray(words)) return 0;
  let max = 0;
  for (const w of words) if (typeof w.end === 'number' && w.end > max) max = w.end;
  return max;
}

async function transcribeWithElevenLabs(audio: File, language?: string): Promise<TranscriptionResult> {
  const fd = new FormData();
  fd.append('file', audio, audio.name || 'audio.webm');
  fd.append('model_id', 'scribe_v1');
  fd.append('timestamps_granularity', 'word');
  fd.append('tag_audio_events', 'false'); // keep transcripts clean of "(laughter)" etc.
  if (language) fd.append('language_code', language);

  const t0 = Date.now();
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! },
    body: fd,
  });
  if (!res.ok) throw new Error(`ElevenLabs STT ${res.status}: ${await res.text()}`);
  const data = await res.json() as { text?: string; words?: ScribeWord[]; language_code?: string };
  return {
    text: data.text ?? '',
    words: scribeWordsToTimings(data.words),
    durationSec: scribeDurationSec(data.words),
    provider: 'elevenlabs',
    latencyMs: Date.now() - t0,
    detectedLanguage: data.language_code,
  };
}

// ── OpenAI Whisper ───────────────────────────────────────────────────────────

// Answer-AGNOSTIC Rioplatense anchor, passed only with a Spanish language hint. See
// /api/transcribe for the full rationale.
const ES_PRIME = 'Lo siguiente es una frase corta en español rioplatense de Argentina.';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

async function transcribeWithWhisper(audio: File, language?: string, includePrime = true): Promise<TranscriptionResult> {
  const isSpanish = !!language && language.toLowerCase().startsWith('es');
  const params: Record<string, unknown> = {
    file: audio,
    model: 'whisper-1',
    temperature: 0,
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
    ...(language ? { language } : {}),
    ...(isSpanish && includePrime ? { prompt: ES_PRIME } : {}),
  };
  const t0 = Date.now();
  // SDK return type is narrowed by response_format at runtime; cast needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (getOpenAI().audio.transcriptions.create as any)(params) as {
    text: string; words?: WordTiming[]; duration?: number; language?: string;
  };
  return {
    text: result.text,
    words: (result.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end })),
    durationSec: result.duration ?? 0,
    provider: 'whisper',
    latencyMs: Date.now() - t0,
    detectedLanguage: result.language,
  };
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export interface TranscribeOpts {
  language?: string;            // force a language ('es' / 'en'); omit for auto-detect
  provider?: TranscriptionProvider; // override the env-selected provider
  whisperPrime?: boolean;       // include the Rioplatense prime on Spanish-forced Whisper calls
}

export async function transcribeAudio(audio: File, opts: TranscribeOpts = {}): Promise<TranscriptionResult> {
  const provider = opts.provider ?? resolveProvider();
  if (provider === 'elevenlabs') {
    try {
      return await transcribeWithElevenLabs(audio, opts.language);
    } catch (e) {
      console.error('[transcription] ElevenLabs failed, falling back to Whisper:', e instanceof Error ? e.message : e);
      return transcribeWithWhisper(audio, opts.language, opts.whisperPrime ?? true);
    }
  }
  return transcribeWithWhisper(audio, opts.language, opts.whisperPrime ?? true);
}
