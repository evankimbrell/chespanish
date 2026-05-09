import { ElevenLabsClient } from 'elevenlabs';

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });

export async function GET() {
  const { voices } = await client.voices.getAll();

  // Return every voice with the fields useful for picking
  const list = voices.map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    labels: v.labels ?? {},
    category: v.category,
    description: v.description ?? '',
  }));

  return Response.json(list);
}
