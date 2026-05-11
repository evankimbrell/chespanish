import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[transcribe] OPENAI_API_KEY not set');
    return new Response('OPENAI_API_KEY not configured', { status: 500 });
  }

  const fd = await req.formData();
  const audio = fd.get('audio') as File | null;

  if (!audio) return new Response('audio required', { status: 400 });

  try {
    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
    });
    return Response.json({ transcript: result.text });
  } catch (e) {
    console.error('[transcribe] Whisper error:', e);
    return new Response(String(e), { status: 500 });
  }
}
