import path from 'path';
import fs from 'fs';

const SPANISH_VOICE = 'qnvusyIjzlSoWYJ0C2Nm';
const ENGLISH_VOICE = 'nzFihrBIvB34imQBuxub';

export async function generateTestAudio(
  text: string,
  voice: 'english' | 'spanish' = 'spanish'
): Promise<Buffer> {
  const voiceId = voice === 'spanish' ? SPANISH_VOICE : ENGLISH_VOICE;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${body}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function saveTestAudio(
  runId: string,
  scenarioId: string,
  audioBuffer: Buffer
): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'test-audio');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${runId}-${scenarioId}.mp3`;
  fs.writeFileSync(path.join(dir, filename), audioBuffer);
  return `/test-audio/${filename}`;
}
