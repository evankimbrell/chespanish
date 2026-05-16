import fs from 'fs';
import path from 'path';
import type { WordTiming, PlayMeta } from '@/lib/types';

export const maxDuration = 300; // 5-minute timeout for long lessons

const ENGLISH_VOICE = 'nzFihrBIvB34imQBuxub';
const SPANISH_VOICE = 'qnvusyIjzlSoWYJ0C2Nm'; // Facundo
const CONCURRENCY = 4; // parallel ElevenLabs calls (plan limit is 5, use 4 for safety)

type VoiceSegment = { type: 'english' | 'spanish'; text: string; sectionName?: string };
type Segment = VoiceSegment | { type: 'prompt'; text: '' };
type Play = { segments: VoiceSegment[]; promptAfter: boolean; text: string; sectionName?: string };

function parseLesson(transcript: string): Segment[] {
  const parts = transcript.split(/(<\/?English voice>|<\/?Spanish voice>|<\/?prompt>|<section[^>]*>|<\/section>)/gi);
  let current: 'english' | 'spanish' | null = null;
  let currentSection: string | undefined = undefined;
  const segs: Segment[] = [];
  for (const part of parts) {
    const clean = part.trim();
    if (!clean) continue;
    if (/^<English voice>$/i.test(clean)) { current = 'english'; }
    else if (/^<Spanish voice>$/i.test(clean)) { current = 'spanish'; }
    else if (/^<\/(?:English|Spanish) voice>$/i.test(clean)) { /* closing tag — skip */ }
    else if (/^<section/i.test(clean)) {
      const m = clean.match(/name="([^"]+)"/i);
      currentSection = m ? m[1] : undefined;
    }
    else if (/^<\/section>/i.test(clean)) { currentSection = undefined; }
    else if (/^<prompt>$/i.test(clean)) { segs.push({ type: 'prompt', text: '' }); }
    else if (/^<\/prompt>$/i.test(clean)) { /* closing prompt tag — skip */ }
    else if (current) { segs.push({ type: current, text: clean, sectionName: currentSection }); }
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
        plays.push({ segments: current, promptAfter: true, text: raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), sectionName: current[0]?.sectionName });
        current = [];
      }
    } else {
      current.push(seg as VoiceSegment);
    }
  }
  if (current.length > 0) {
    const raw = current.map((s) => s.text).join(' ');
    plays.push({ segments: current, promptAfter: false, text: raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), sectionName: current[0]?.sectionName });
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
    return Response.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 });
  }

  const { transcript, userName, startIdx = 0, count } = await req.json();
  if (!transcript) return Response.json({ error: 'missing_transcript' }, { status: 400 });

  try {
    const segments = parseLesson(transcript);
    const allPlays = groupIntoPlays(segments);
    const totalCount = allPlays.length;
    const limit = count ?? totalCount;
    const batch = allPlays.slice(startIdx, startIdx + limit);

    console.log(`[lesson/audio] ${totalCount} total plays, generating ${batch.length} starting at idx ${startIdx}`);

    const safeUser = (userName ?? 'student').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const timestamp = startIdx === 0 ? Date.now() : undefined;
    // On subsequent calls, derive timestamp from existing files to keep consistent naming
    const lessonsDir = path.join(process.cwd(), 'public', 'lessons');
    fs.mkdirSync(lessonsDir, { recursive: true });

    // On first call, find a new timestamp; on subsequent calls, caller passes userName and we reuse the pattern
    // Use a fixed timestamp per lesson session stored by caller — for simplicity, embed startIdx in filename
    const ts = timestamp ?? Date.now();

    const result: { audioUrl: string; promptAfter: boolean; text: string; wordTimings: WordTiming[]; sectionName?: string }[] = new Array(batch.length);

    // Process plays in parallel batches to stay within ElevenLabs rate limits
    for (let b = 0; b < batch.length; b += CONCURRENCY) {
      const batchItems = batch
        .slice(b, b + CONCURRENCY)
        .map((play, j) => ({ play, i: b + j }));

      await Promise.all(batchItems.map(async ({ play, i }) => {
        const globalIdx = startIdx + i;
        const filename = `${safeUser}-${ts}-${globalIdx}.mp3`;
        const filePath = path.join(lessonsDir, filename);
        const { buffer, wordTimings } = await generatePlayAudio(play);
        fs.writeFileSync(filePath, buffer);
        result[i] = { audioUrl: `/lessons/${filename}`, promptAfter: play.promptAfter, text: play.text, wordTimings, sectionName: play.sectionName };
      }));

      console.log(`[lesson/audio] sub-batch ${Math.floor(b / CONCURRENCY) + 1}/${Math.ceil(batch.length / CONCURRENCY)} done`);
    }

    // On first call, also return full play metadata (no audio) for immediate section/UI display
    const extra: { totalCount?: number; allPlayMeta?: PlayMeta[] } = {};
    if (startIdx === 0) {
      extra.totalCount = totalCount;
      extra.allPlayMeta = allPlays.map((p) => ({
        promptAfter: p.promptAfter,
        text: p.text,
        sectionName: p.sectionName,
      }));
    }

    return Response.json({ plays: result, ...extra });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[lesson/audio] error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
