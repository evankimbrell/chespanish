import fs from 'fs';
import path from 'path';
import type { WordTiming } from '@/lib/types';

const ENGLISH_VOICE = 'nzFihrBIvB34imQBuxub';
const SPANISH_VOICE = 'qnvusyIjzlSoWYJ0C2Nm'; // Facundo

type VoiceSegment = { type: 'english' | 'spanish'; text: string };
type Segment = VoiceSegment | { type: 'prompt'; text: '' };
type Play = { segments: VoiceSegment[]; promptAfter: boolean; text: string };

function parseLesson(transcript: string): Segment[] {
  const parts = transcript.split(/(<\/?English voice>|<\/?Spanish voice>|<prompt>)/gi);
  let current: 'english' | 'spanish' | null = null;
  const segs: Segment[] = [];
  for (const part of parts) {
    const clean = part.trim();
    if (!clean) continue;
    if (/^<English voice>$/i.test(clean)) { current = 'english'; }
    else if (/^<Spanish voice>$/i.test(clean)) { current = 'spanish'; }
    else if (/^<\/(?:English|Spanish) voice>$/i.test(clean)) { /* closing tag — skip */ }
    else if (/^<prompt>$/i.test(clean)) { segs.push({ type: 'prompt', text: '' }); }
    else if (current) { segs.push({ type: current, text: clean }); }
  }
  return segs;
}

function groupIntoPlays(segments: Segment[]): Play[] {
  const plays: Play[] = [];
  let current: VoiceSegment[] = [];
  for (const seg of segments) {
    if (seg.type === 'prompt') {
      if (current.length > 0) {
        const raw = current.map((s) => s.text).join(' ');
        plays.push({ segments: current, promptAfter: true, text: raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
        current = [];
      }
    } else {
      current.push(seg as VoiceSegment);
    }
  }
  if (current.length > 0) {
    const raw = current.map((s) => s.text).join(' ');
    plays.push({ segments: current, promptAfter: false, text: raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
  }
  return plays;
}

function splitAtSentences(text: string, maxChars = 4000): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let current = '';
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

type ElevenLabsAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

function charAlignmentToWordTimings(alignment: ElevenLabsAlignment, offsetSec: number): WordTiming[] {
  const timings: WordTiming[] = [];
  let word = '';
  let wordStart = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const ch = alignment.characters[i];
    if (ch.trim() === '') {
      if (word) {
        timings.push({
          word,
          start: wordStart + offsetSec,
          end: (alignment.character_end_times_seconds[i - 1] ?? 0) + offsetSec,
        });
        word = '';
      }
    } else {
      if (!word) wordStart = alignment.character_start_times_seconds[i];
      word += ch;
    }
  }
  if (word) {
    const last = alignment.character_end_times_seconds.at(-1) ?? 0;
    timings.push({ word, start: wordStart + offsetSec, end: last + offsetSec });
  }
  return timings;
}

async function textToBufferWithTimings(
  text: string,
  voiceId: string,
  offsetSec: number
): Promise<{ buffer: Buffer; wordTimings: WordTiming[]; durationSec: number }> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs /with-timestamps error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const buffer = Buffer.from(data.audio_base64, 'base64');
  const wordTimings = charAlignmentToWordTimings(data.alignment, offsetSec);
  const durationSec = data.alignment.character_end_times_seconds.at(-1) ?? 0;

  return { buffer, wordTimings, durationSec };
}

async function generatePlayAudio(
  play: Play
): Promise<{ buffer: Buffer; wordTimings: WordTiming[] }> {
  const buffers: Buffer[] = [];
  const allTimings: WordTiming[] = [];
  let offsetSec = 0;

  for (const seg of play.segments) {
    const voiceId = seg.type === 'english' ? ENGLISH_VOICE : SPANISH_VOICE;
    const chunks = splitAtSentences(seg.text);
    for (const chunk of chunks) {
      const { buffer, wordTimings, durationSec } = await textToBufferWithTimings(chunk, voiceId, offsetSec);
      buffers.push(buffer);
      allTimings.push(...wordTimings);
      offsetSec += durationSec;
    }
  }

  return { buffer: Buffer.concat(buffers), wordTimings: allTimings };
}

export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return new Response('ELEVENLABS_API_KEY not configured', { status: 500 });
  }

  const { transcript, userName } = await req.json();
  if (!transcript) return Response.json({ error: 'missing_transcript' }, { status: 400 });

  const segments = parseLesson(transcript);
  const plays = groupIntoPlays(segments);

  const safeUser = (userName ?? 'student').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const timestamp = Date.now();
  const lessonsDir = path.join(process.cwd(), 'public', 'lessons');
  fs.mkdirSync(lessonsDir, { recursive: true });

  const result: { audioUrl: string; promptAfter: boolean; text: string; wordTimings: WordTiming[] }[] = [];

  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];
    const filename = `${safeUser}-${timestamp}-${i}.mp3`;
    const filePath = path.join(lessonsDir, filename);

    const { buffer, wordTimings } = await generatePlayAudio(play);
    fs.writeFileSync(filePath, buffer);

    result.push({ audioUrl: `/lessons/${filename}`, promptAfter: play.promptAfter, text: play.text, wordTimings });
  }

  return Response.json({ plays: result });
}
