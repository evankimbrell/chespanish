import { ElevenLabsClient } from 'elevenlabs';
import { NextRequest } from 'next/server';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

// Facundo — Argentine Spanish male voice
export const DEFAULT_VOICE_ID = 'qnvusyIjzlSoWYJ0C2Nm';

async function streamTTS(text: string, voiceId: string): Promise<ReadableStream<Uint8Array>> {
  const result = await client.textToSpeech.convertAsStream(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
    optimize_streaming_latency: 3,
  });

  // The SDK returns an async iterable — wrap it in a Web ReadableStream
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result as AsyncIterable<Buffer>) {
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
      } catch (err) {
        console.error('[TTS] Stream error:', err);
        controller.error(err);
      }
    },
  });
}

// GET /api/tts — browser test: visit this URL to hear "A dónde vas"
export async function GET() {
  if (!process.env.ELEVENLABS_API_KEY) {
    return new Response('ELEVENLABS_API_KEY not configured', { status: 500 });
  }
  try {
    const stream = await streamTTS('A dónde vas', DEFAULT_VOICE_ID);
    return new Response(stream, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
    });
  } catch (err) {
    console.error('[TTS] GET error:', err);
    return new Response(String(err), { status: 500 });
  }
}

// POST /api/tts — used by useTTS hook
export async function POST(req: NextRequest) {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('[TTS] ELEVENLABS_API_KEY is not set');
    return new Response('ELEVENLABS_API_KEY not configured', { status: 500 });
  }

  const { text, voiceId = DEFAULT_VOICE_ID } = await req.json();

  if (!text?.trim()) {
    return new Response('text is required', { status: 400 });
  }

  try {
    const stream = await streamTTS(text, voiceId);
    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('[TTS] ElevenLabs error:', err);
    return new Response(String(err), { status: 500 });
  }
}
