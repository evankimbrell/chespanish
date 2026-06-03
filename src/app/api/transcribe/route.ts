import OpenAI from 'openai';
import type { TranscriptionCreateParams } from 'openai/resources/audio/transcriptions';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Diacritics that appear in Czech/Slovak/Slovenian but never in Spanish.
// If Whisper returns these, it misidentified the language.
const SLAVIC_RE = /[ČčŠšŽžĚěŘřŮů]/;

// Answer-AGNOSTIC Rioplatense anchor. Passed only when we already know the audio is
// Spanish (forceLang='es'). It sets the language/accent context (steering away from
// non-Argentine outputs like the Mexican "quiúbole") WITHOUT seeding any specific
// phrase, so it can't bias the transcript toward a particular expected answer.
const ES_PRIME = 'Lo siguiente es una frase corta en español rioplatense de Argentina.';

async function runTranscription(audio: File, forceLang?: string): Promise<string> {
  // temperature 0 = greedy decoding, which avoids the temperature-fallback escalation
  // that makes Whisper hallucinate confident wrong words on short clips. A `prompt`
  // is only added with a known Spanish language hint (an English prompt would bias
  // toward English / translation; a Spanish prompt under language='es' is safe).
  const params: TranscriptionCreateParams = {
    file: audio,
    model: 'whisper-1',
    temperature: 0,
    ...(forceLang ? { language: forceLang, prompt: ES_PRIME } : {}),
  };
  const result = await openai.audio.transcriptions.create(params);
  return result.text;
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
    let text = await runTranscription(audio, language);

    // If Slavic characters appear, Whisper mis-detected the language — retry forced to Spanish
    if (!allowEnglish && SLAVIC_RE.test(text)) {
      console.warn('[transcribe] Slavic chars detected, retrying with language:es');
      text = await runTranscription(audio, 'es');
    }

    return Response.json({ transcript: text });
  } catch (e) {
    console.error('[transcribe] Whisper error:', e);
    return new Response(String(e), { status: 500 });
  }
}
