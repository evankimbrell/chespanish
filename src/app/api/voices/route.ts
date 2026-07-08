import { ElevenLabsClient } from 'elevenlabs';

// Lazy init — a module-scope constructor throws when the key is absent, which crashes
// `next build` page-data collection in environments without secrets.
let _client: ElevenLabsClient | null = null;
function getClient(): ElevenLabsClient {
  if (!_client) _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
  return _client;
}

export async function GET(req: Request) {
  const { voices } = await getClient().voices.getAll();
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
