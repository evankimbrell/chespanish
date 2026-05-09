import { ElevenLabsClient } from 'elevenlabs';

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });

export async function GET(req: Request) {
  const { voices } = await client.voices.getAll();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('name')?.toLowerCase();

  const list = voices
    .filter((v) => !search || v.name?.toLowerCase().includes(search))
    .map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      labels: v.labels ?? {},
      category: v.category,
      description: v.description ?? '',
    }));

  return Response.json(list);
}
