import path from 'path';
import fs from 'fs';
import { SPANISH_MALE_VOICE_ID, NARRATOR_VOICE_ID } from '@/lib/voices';

const SPANISH_VOICE = SPANISH_MALE_VOICE_ID;
const ENGLISH_VOICE = NARRATOR_VOICE_ID;

export async function generateTestAudio(
  text: string,
  voice: 'english' | 'spanish' = 'spanish',
  speed = 1.0
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
      // ElevenLabs speed range is 0.7–1.2; clamp to avoid 400 errors
      ...(speed !== 1.0 ? { voice_settings: { speed: Math.max(0.7, Math.min(1.2, speed)) } } : {}),
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
