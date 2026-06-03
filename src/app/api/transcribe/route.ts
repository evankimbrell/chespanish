import OpenAI from 'openai';
import type { TranscriptionCreateParams } from 'openai/resources/audio/transcriptions';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Diacritics that appear in Czech/Slovak/Slovenian but never in Spanish.
// If Whisper returns these, it misidentified the language.
const SLAVIC_RE = /[ČčŠšŽžĚěŘřŮů]/;

async function runTranscription(audio: File, forceLang?: string): Promise<string> {
  // Never pass a `prompt`. Whisper's prompt is a language-matching context prime, not
  // an instruction — an English prompt biases Whisper into emitting English, i.e.
  // translating Spanish audio. Pure auto-detect transcribes literally in whatever
  // language was actually spoken. `language` is only forced on the Slavic-garble retry.
  const params: TranscriptionCreateParams = {
    file: audio,
    model: 'whisper-1',
    ...(forceLang ? { language: forceLang } : {}),
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
