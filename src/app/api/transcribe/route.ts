import type { ResponseTiming, WordTiming } from '@/lib/types';
import { transcribeAudio, resolveProvider, ES_PRIME } from '@/lib/transcription';
import { matchesAnswer } from '@/lib/vocab-match';

// Diacritics that appear in Czech/Slovak/Slovenian but never in Spanish.
// If the STT returns these, it misidentified the language.
const SLAVIC_RE = /[ČčŠšŽžĚěŘřŮů]/;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Derive speaking-duration / pause / silence metrics from word timestamps.
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
  const fd = await req.formData();
  const audio = fd.get('audio') as File | null;
  const allowEnglish = fd.get('allowEnglish') === '1';
  // Optional language hint (e.g. 'es' for lesson prompts that ask for a specific Spanish
  // phrase). Short clips auto-detect unreliably, so the caller can tell the STT the
  // language. Absent (level test, ask-a-question) → pure auto-detect.
  const language = (fd.get('language') as string | null) || undefined;
  // Optional expected answer (vocab speak cards). Bare single words are the worst
  // case for any STT — Scribe, even forced to Spanish, can snap one syllable to an
  // adjacent English token ("más" → "Mars."). See the biased retry below.
  const expected = (fd.get('expected') as string | null) || undefined;

  if (!audio) return new Response('audio required', { status: 400 });

  try {
    let result = await transcribeAudio(audio, { language });

    // If Slavic characters appear, the STT mis-detected the language — retry forced to Spanish
    if (!allowEnglish && SLAVIC_RE.test(result.text)) {
      console.warn('[transcribe] Slavic chars detected, retrying with language:es');
      result = await transcribeAudio(audio, { language: 'es' });
    }

    // Expected-answer second chance: the first pass heard real speech but not the
    // target — re-decode the SAME clip with Whisper primed toward the target, and
    // keep that result only if it matches. The verdict this feeds is advisory (the
    // learner still grades themselves), so a generous hint beats a false "Not quite"
    // on a correctly-pronounced word. The speech guard (words > 0) keeps silence
    // from being hallucinated into a match.
    if (expected && result.words.length > 0 && !matchesAnswer(result.text, expected)) {
      try {
        const biased = await transcribeAudio(audio, {
          language: 'es',
          provider: 'whisper',
          prompt: `${ES_PRIME} Vocabulario: ${expected}.`,
        });
        if (matchesAnswer(biased.text, expected)) {
          console.log(`[transcribe] biased retry rescued "${result.text}" -> "${biased.text}"`);
          result = biased;
        }
      } catch (e) {
        console.warn('[transcribe] biased retry failed, keeping first pass:', e instanceof Error ? e.message : e);
      }
    }

    console.log(`[transcribe] ${result.provider} ${result.latencyMs}ms | ${result.words.length} words`);
    const timing = computeTiming(result.words, result.durationSec);
    return Response.json({ transcript: result.text, timing, provider: result.provider });
  } catch (e) {
    console.error(`[transcribe] ${resolveProvider()} error:`, e);
    return new Response(String(e), { status: 500 });
  }
}
