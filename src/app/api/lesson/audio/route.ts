import { ElevenLabsClient } from 'elevenlabs';
import fs from 'fs';
import path from 'path';

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });

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

async function textToBuffer(text: string, voiceId: string): Promise<Buffer> {
  const stream = await client.textToSpeech.convertAsStream(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
  });
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function generatePlayAudio(play: Play): Promise<Buffer> {
  const buffers: Buffer[] = [];
  for (const seg of play.segments) {
    const voiceId = seg.type === 'english' ? ENGLISH_VOICE : SPANISH_VOICE;
    const chunks = splitAtSentences(seg.text);
    for (const chunk of chunks) {
      buffers.push(await textToBuffer(chunk, voiceId));
    }
  }
  return Buffer.concat(buffers);
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

  const result: { audioUrl: string; promptAfter: boolean; text: string }[] = [];

  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];
    const filename = `${safeUser}-${timestamp}-${i}.mp3`;
    const filePath = path.join(lessonsDir, filename);

    const audio = await generatePlayAudio(play);
    fs.writeFileSync(filePath, audio);

    result.push({ audioUrl: `/lessons/${filename}`, promptAfter: play.promptAfter, text: play.text });
  }

  return Response.json({ plays: result });
}
