const SPANISH_VOICE = 'qnvusyIjzlSoWYJ0C2Nm';

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text?.trim()) return Response.json({ error: 'missing text' }, { status: 400 });

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
