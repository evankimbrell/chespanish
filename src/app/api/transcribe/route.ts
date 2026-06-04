import OpenAI from 'openai';
import type { ResponseTiming } from '@/lib/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Diacritics that appear in Czech/Slovak/Slovenian but never in Spanish.
// If Whisper returns these, it misidentified the language.
const SLAVIC_RE = /[ČčŠšŽžĚěŘřŮů]/;

// Answer-AGNOSTIC Rioplatense anchor. Passed only when we already know the audio is
// Spanish (forceLang='es'). It sets the language/accent context (steering away from
// non-Argentine outputs like the Mexican "quiúbole") WITHOUT seeding any specific
// phrase, so it can't bias the transcript toward a particular expected answer.
const ES_PRIME = 'Lo siguiente es una frase corta en español rioplatense de Argentina.';

interface WordTiming { word: string; start: number; end: number; }
interface TranscriptionResult { text: string; words: WordTiming[]; durationSec: number; }

async function runTranscription(audio: File, forceLang?: string): Promise<TranscriptionResult> {
  // temperature 0 = greedy decoding, which avoids the temperature-fallback escalation
  // that makes Whisper hallucinate confident wrong words on short clips. A `prompt`
  // is only added with a known Spanish language hint (an English prompt would bias
  // toward English / translation; a Spanish prompt under language='es' is safe).
  // verbose_json + word granularity also gives us per-word timestamps for pause analysis.
  const params: Record<string, unknown> = {
    file: audio,
    model: 'whisper-1',
    temperature: 0,
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
    ...(forceLang ? { language: forceLang, prompt: ES_PRIME } : {}),
  };
  // SDK return type is narrowed by response_format at runtime; cast needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (openai.audio.transcriptions.create as any)(params) as {
    text: string; words?: WordTiming[]; duration?: number;
  };
  return { text: result.text, words: result.words ?? [], durationSec: result.duration ?? 0 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Derive speaking-duration / pause / silence metrics from Whisper word timestamps.
// Returns null when there's no usable speech (no words).
// A gap must exceed this to count as a real pause/silence. Sub-300ms gaps are just
// normal word spacing, not hesitation — counting them would inflate the silence %.
const PAUSE_THRESHOLD = 0.3;

function computeTiming(words: WordTiming[], durationSec: number): ResponseTiming | null {
  if (words.length < 1 || durationSec <= 0) return null;
  const first = words[0].start;
  const last = words[words.length - 1].end;
  const trailing = Math.max(0, durationSec - last);
  let voiced = 0;
  let longestPause = 0;
  const pauses: number[] = [];
  // Silence = only the gaps longer than PAUSE_THRESHOLD: the lead-in (recall
  // latency), each notable inter-word pause, and trailing dead air. Micro-gaps
  // between words are excluded.
  let pauseSilence = 0;
  if (first > PAUSE_THRESHOLD) pauseSilence += first;
  if (trailing > PAUSE_THRESHOLD) pauseSilence += trailing;
  for (let i = 0; i < words.length; i++) {
    voiced += Math.max(0, words[i].end - words[i].start);
    if (i > 0) {
      const gap = words[i].start - words[i - 1].end;
      if (gap > longestPause) longestPause = gap;
      if (gap > PAUSE_THRESHOLD) { pauses.push(round2(gap)); pauseSilence += gap; }
    }
  }
  const speakingSpan = Math.max(0, last - first);
  return {
    recordingSec: round2(durationSec),
    speakingSpanSec: round2(speakingSpan),
    voicedSec: round2(voiced),
    silenceSec: round2(pauseSilence),
    silencePct: Math.round((pauseSilence / durationSec) * 100),
    initialSilenceSec: round2(first),
    trailingSilenceSec: round2(trailing),
    longestPauseSec: round2(longestPause),
    pauses,
    wordCount: words.length,
    wpm: speakingSpan > 0 ? Math.round((words.length / speakingSpan) * 60) : 0,
  };
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[transcribe] OPENAI_API_KEY not set');
    return new Response('OPENAI_API_KEY not configured', { status: 500 });
  }

  const fd = await req.formData();
  const audio = fd.get('audio') as File | null;
  const allowEnglish = fd.get('allowEnglish') === '1';
  // Optional language hint (e.g. 'es' for lesson prompts that ask for a specific Spanish
  // phrase). Short clips auto-detect unreliably, so the caller can tell Whisper the
  // language. Absent (level test, ask-a-question) → pure auto-detect.
  const language = (fd.get('language') as string | null) || undefined;

  if (!audio) return new Response('audio required', { status: 400 });

  try {
    let result = await runTranscription(audio, language);

    // If Slavic characters appear, Whisper mis-detected the language — retry forced to Spanish
    if (!allowEnglish && SLAVIC_RE.test(result.text)) {
      console.warn('[transcribe] Slavic chars detected, retrying with language:es');
      result = await runTranscription(audio, 'es');
    }

    const timing = computeTiming(result.words, result.durationSec);
    return Response.json({ transcript: result.text, timing });
  } catch (e) {
    console.error('[transcribe] Whisper error:', e);
    return new Response(String(e), { status: 500 });
  }
}
