import { ElevenLabsClient } from 'elevenlabs';
import { NextRequest } from 'next/server';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

// Facundo — Argentine Spanish male voice
export const DEFAULT_VOICE_ID = 'qnvusyIjzlSoWYJ0C2Nm';

export async function POST(req: NextRequest) {
  const { text, voiceId = DEFAULT_VOICE_ID } = await req.json();

  if (!text?.trim()) {
    return new Response('text is required', { status: 400 });
  }

  const nodeStream = await client.textToSpeech.convertAsStream(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
    optimize_streaming_latency: 3,
  });

  // Convert Node.js Readable → Web API ReadableStream so Next.js can stream it
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      nodeStream.on('end', () => {
        controller.close();
      });
      nodeStream.on('error', (err: Error) => {
        controller.error(err);
      });
    },
  });

  return new Response(webStream, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
