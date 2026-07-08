import { transcribeAudio, type TranscriptionProvider } from '@/lib/transcription';

// Benchmark: run the SAME audio through Whisper and ElevenLabs Scribe and return both
// results side by side (transcript, latency, word timings) so we can compare latency
// and verbatim accuracy before switching providers. Dev/debug use only.
export async function POST(req: Request) {
  const fd = await req.formData();
  const audio = fd.get('audio') as File | null;
  const language = (fd.get('language') as string | null) || undefined;
  if (!audio) return new Response('audio required', { status: 400 });

  const run = async (provider: TranscriptionProvider) => {
    try {
      const r = await transcribeAudio(audio, { language, provider });
      // transcribeAudio silently falls back to Whisper if ElevenLabs errors; for the
      // bench that must read as a failure of the requested provider, not a result.
      if (r.provider !== provider) {
        return { ok: false as const, provider, error: `fell back to ${r.provider} — check server logs for the ElevenLabs error` };
      }
      return {
        ok: true as const,
        provider,
        latencyMs: r.latencyMs,
        text: r.text,
        wordCount: r.words.length,
        durationSec: r.durationSec,
        detectedLanguage: r.detectedLanguage,
      };
    } catch (e) {
      return { ok: false as const, provider, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const [whisper, elevenlabs] = await Promise.all([run('whisper'), run('elevenlabs')]);
  return Response.json({ whisper, elevenlabs });
}
