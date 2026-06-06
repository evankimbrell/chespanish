import { SPANISH_MALE_VOICE_ID } from '@/lib/voices';

const SPANISH_VOICE = SPANISH_MALE_VOICE_ID;

export async function POST(req: Request) {
  const { text, speed } = await req.json();
  if (!text?.trim()) return Response.json({ error: 'missing text' }, { status: 400 });
  const spanishSpeed = typeof speed === 'number' && speed >= 0.7 && speed <= 1.2 ? speed : 1.0;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${SPANISH_VOICE}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        output_format: 'mp3_44100_128',
        ...(spanishSpeed !== 1 ? { voice_settings: { speed: spanishSpeed } } : {}),
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `ElevenLabs error ${res.status}: ${err}` }, { status: 500 });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}
