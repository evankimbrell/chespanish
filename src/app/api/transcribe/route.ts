import OpenAI from 'openai';
import type { TranscriptionCreateParams } from 'openai/resources/audio/transcriptions';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const ARGENTINE_PROMPT =
  'Che, ¿qué hacés? ¿Querés tomar algo antes de salir? No sé, depende. Sí, claro que sí. Mirá, la verdad es que no tengo tiempo. ¿Y vos qué pensás? No entendí bien lo que me dijiste.';

// Diacritics that appear in Czech/Slovak/Slovenian but never in Spanish.
// If Whisper returns these, it misidentified the language.
const SLAVIC_RE = /[ČčŠšŽžĚěŘřŮů]/;

async function runTranscription(audio: File, forceLang?: string, noPrompt?: boolean): Promise<string> {
  const params: TranscriptionCreateParams = {
    file: audio,
    model: 'whisper-1',
    ...(forceLang
      ? { language: forceLang }
      : noPrompt
        ? {}
        : { prompt: ARGENTINE_PROMPT }),
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

  if (!audio) return new Response('audio required', { status: 400 });

  try {
    let text = await runTranscription(audio, undefined, allowEnglish);

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
