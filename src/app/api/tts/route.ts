import { ElevenLabsClient } from 'elevenlabs';
import { NextRequest } from 'next/server';
import { SPANISH_MALE_VOICE_ID, SPANISH_FEMALE_VOICE_ID } from '@/lib/voices';

// Lazy init — a module-scope constructor throws when the key is absent, which crashes
// `next build` page-data collection in environments without secrets.
let _client: ElevenLabsClient | null = null;
function getClient(): ElevenLabsClient {
  if (!_client) _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
  return _client;
}

// Active Argentine Spanish voices (see src/lib/voices.ts)
export const DEFAULT_VOICE_ID = SPANISH_MALE_VOICE_ID;
const VOICE_B = SPANISH_FEMALE_VOICE_ID;

// Split "Persona A: foo Persona B: bar" into ordered speaker segments
function parseDialogue(text: string): { speaker: 'A' | 'B'; text: string }[] | null {
  if (!text.includes('Persona A:') && !text.includes('Persona B:')) return null;
  const matches = [...text.matchAll(/Persona ([AB]):\s*(.*?)(?=Persona [AB]:|$)/g)];
  const segments = matches
    .map((m) => ({ speaker: m[1] as 'A' | 'B', text: m[2].trim() }))
    .filter((s) => s.text.length > 0);
  return segments.length > 1 ? segments : null;
}

async function segmentToBuffer(text: string, voiceId: string): Promise<Buffer> {
  const result = await getClient().textToSpeech.convertAsStream(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
  });
  const chunks: Buffer[] = [];
  for await (const chunk of result as AsyncIterable<Buffer>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function streamTTS(text: string, voiceId: string): Promise<ReadableStream<Uint8Array>> {
  const result = await getClient().textToSpeech.convertAsStream(voiceId, {
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
    // Multi-speaker dialogue: stitch per-segment MP3 buffers into one response
    const segments = parseDialogue(text);
    if (segments) {
      const buffers: Buffer[] = [];
      for (const seg of segments) {
        buffers.push(await segmentToBuffer(seg.text, seg.speaker === 'A' ? DEFAULT_VOICE_ID : VOICE_B));
      }
      const combined = Buffer.concat(buffers);
      return new Response(combined, {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
      });
    }

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
