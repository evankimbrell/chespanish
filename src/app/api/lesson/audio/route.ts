import fs from 'fs';
import path from 'path';
import type { WordTiming, PlayMeta } from '@/lib/types';
import { NARRATOR_VOICE_ID, SPANISH_MALE_VOICE_ID, SPANISH_FEMALE_VOICE_ID } from '@/lib/voices';

export const maxDuration = 300; // 5-minute timeout for long lessons

const ENGLISH_VOICE = NARRATOR_VOICE_ID;
const SPANISH_VOICE = SPANISH_MALE_VOICE_ID;    // active male — spanish 1 / 3
const SPANISH_VOICE_2 = SPANISH_FEMALE_VOICE_ID; // active female — spanish 2 / 4
const CONCURRENCY = 4;

// voiceIndex 1–4 maps to: male, female, male, female.
// The lesson prompt labels these genders so GPT writes matching gendered agreement
// (e.g. the male voice says "estoy cansado", the female voice "estoy cansada").
const SPANISH_VOICES = [SPANISH_VOICE, SPANISH_VOICE_2, SPANISH_VOICE, SPANISH_VOICE_2];

type VoiceSegment = { type: 'english' | 'spanish'; voiceIndex: number; text: string; sectionName?: string };
type Segment = VoiceSegment | { type: 'prompt'; text: '' };
type Play = { segments: VoiceSegment[]; promptAfter: boolean; text: string; spanishText?: string; sectionName?: string };

function parseLesson(transcript: string): Segment[] {
  // Handles both old format (<English voice>, <Spanish voice>) and new format
  // (<narrator>, <spanish 1>..<spanish 4>). Tolerant of GPT drift: optional voice
  // numbers (<spanish>), missing spaces (<spanish1>), and stray closing tags
  // (</narrator>, </spanish 1>) — none of which must ever reach TTS.
  const TAG_RE = /(<\/?narrator\s*>|<\/?spanish\s*\d*\s*>|<\/?English voice>|<\/?Spanish voice>|<\/?prompt>|<section[^>]*>|<\/section>)/gi;
  const parts = transcript.split(TAG_RE);
  let currentType: 'english' | 'spanish' | null = null;
  let currentVoiceIndex = 1;
  let currentSection: string | undefined = undefined;
  const segs: Segment[] = [];

  for (const part of parts) {
    const clean = part.trim();
    if (!clean) continue;

    // New format opening tags
    if (/^<narrator\s*>$/i.test(clean)) {
      currentType = 'english'; currentVoiceIndex = 1;
    } else if (/^<spanish\s*(\d*)\s*>$/i.test(clean)) {
      const m = clean.match(/^<spanish\s*(\d*)\s*>$/i);
      const n = m && m[1] ? Number(m[1]) : 1;
      currentType = 'spanish';
      currentVoiceIndex = Math.max(1, Math.min(4, n));
    }
    // Old format opening tags
    else if (/^<English voice>$/i.test(clean)) {
      currentType = 'english'; currentVoiceIndex = 1;
    } else if (/^<Spanish voice>$/i.test(clean)) {
      currentType = 'spanish'; currentVoiceIndex = 1;
    }
    // Section tags
    else if (/^<section/i.test(clean)) {
      const m = clean.match(/name="([^"]+)"/i);
      currentSection = m ? m[1] : undefined;
    } else if (/^<\/section>/i.test(clean)) {
      currentSection = undefined;
    }
    // Prompt tag (open or close)
    else if (/^<\/?prompt>$/i.test(clean)) {
      segs.push({ type: 'prompt', text: '' });
    }
    // Any stray closing tag (</narrator>, </spanish 1>, </English voice>, …) — skip
    else if (/^<\//.test(clean)) {
      // content for the current voice continues after it
    }
    // Content — strip any residual angle-bracket tags as a final safety net so a
    // malformed tag is never spoken aloud, then skip if nothing meaningful remains.
    else if (currentType) {
      const text = clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) segs.push({ type: currentType, voiceIndex: currentVoiceIndex, text, sectionName: currentSection });
    }
  }
  return segs;
}

function groupIntoPlays(segments: Segment[]): Play[] {
  // Phase 1: split into raw groups at each <prompt> marker.
  const groups: { segs: VoiceSegment[]; promptAfter: boolean }[] = [];
  let current: VoiceSegment[] = [];
  for (const seg of segments) {
    if (seg.type === 'prompt') {
      if (current.length > 0) {
        groups.push({ segs: current, promptAfter: true });
        current = [];
      }
    } else {
      current.push(seg as VoiceSegment);
    }
  }
  if (current.length > 0) groups.push({ segs: current, promptAfter: false });

  // Phase 2: resolve the model (Spanish) answer for each prompt and build plays.
  // The expected answer is the Spanish the lesson treats as the target:
  //   - "listen and repeat" pattern: the target is the last Spanish in THIS group.
  //   - "anticipation" pattern (narrator asks → prompt → narrator reveals): this
  //     group has no Spanish, so the answer is the first Spanish of the NEXT group.
  return groups.map((g, gi) => {
    const lastSpanish = [...g.segs].reverse().find((s) => s.type === 'spanish')?.text?.trim();
    const nextFirstSpanish = groups[gi + 1]?.segs.find((s) => s.type === 'spanish')?.text?.trim();
    const spanishText = lastSpanish || (g.promptAfter ? nextFirstSpanish : undefined) || undefined;
    const raw = g.segs.map((s) => s.text).join(' ');
    return {
      segments: g.segs,
      promptAfter: g.promptAfter,
      text: raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      spanishText,
      sectionName: g.segs[0]?.sectionName,
    };
  });
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function textToBufferWithTimings(
  text: string,
  voiceId: string,
  offsetSec: number,
  modelId: string = 'eleven_multilingual_v2',
  languageCode?: string,
): Promise<{ buffer: Buffer; wordTimings: WordTiming[]; durationSec: number }> {
  // Retry transient failures (429 rate limits, 5xx) with exponential backoff.
  // With 100+ plays at concurrency 4, occasional rate-limit blips are expected —
  // a single un-retried failure would otherwise abort the whole batch.
  const MAX_ATTEMPTS = 3;
  let lastErr = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            output_format: 'mp3_44100_128',
            // language_code is honored by eleven_turbo_v2_5 / flash; ignored by older models.
            ...(languageCode ? { language_code: languageCode } : {}),
          }),
        }
      );
    } catch (e) {
      // Network error — retry
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt < MAX_ATTEMPTS) { await sleep(500 * 2 ** (attempt - 1)); continue; }
      throw new Error(`ElevenLabs network error after ${MAX_ATTEMPTS} attempts: ${lastErr}`);
    }

    if (!res.ok) {
      lastErr = `${res.status}: ${await res.text()}`;
      // Retry only on rate-limit / server errors; fail fast on 4xx (bad request, auth)
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      throw new Error(`ElevenLabs /with-timestamps error ${lastErr}`);
    }

    const data = await res.json();
    if (!data?.audio_base64) {
      throw new Error('ElevenLabs returned no audio');
    }
    const buffer = Buffer.from(data.audio_base64, 'base64');
    // Alignment can occasionally be absent; degrade to no word timings rather than crash.
    const wordTimings = data.alignment ? charAlignmentToWordTimings(data.alignment, offsetSec) : [];
    const durationSec = data.alignment?.character_end_times_seconds?.at(-1) ?? 0;
    return { buffer, wordTimings, durationSec };
  }
  throw new Error(`ElevenLabs failed after ${MAX_ATTEMPTS} attempts: ${lastErr}`);
}

async function generatePlayAudio(
  play: Play
): Promise<{ buffer: Buffer; wordTimings: WordTiming[] }> {
  const buffers: Buffer[] = [];
  const allTimings: WordTiming[] = [];
  let offsetSec = 0;

  for (const seg of play.segments) {
    const voiceId = seg.type === 'english' ? ENGLISH_VOICE : (SPANISH_VOICES[(seg.voiceIndex ?? 1) - 1] ?? SPANISH_VOICE);
    // Short, context-free Spanish words (e.g. a lone "dale") are ambiguous to the
    // auto-detecting multilingual model and can render with English phonetics ("day-lay").
    // For these, force Spanish with a language-lockable model (turbo + language_code:'es').
    // Longer Spanish has enough context to pronounce correctly, so it stays on the
    // higher-fidelity multilingual model. Falls back to multilingual on any error.
    const wordCount = seg.text.trim().split(/\s+/).filter(Boolean).length;
    const lockSpanish = seg.type === 'spanish' && wordCount <= 3;
    const chunks = splitAtSentences(seg.text);
    for (const chunk of chunks) {
      // A bare, context-free short word makes ElevenLabs run past the word and append
      // a trailing filler/onset ("después" → "despues eeeh") because it has no sentence
      // boundary to land on. Adding a period gives it a clean falling close so it stops
      // at the word. Only for the short Spanish case, and only when the text doesn't
      // already end in terminal punctuation.
      const ttsText = lockSpanish && !/[.!?…]$/.test(chunk.trim()) ? `${chunk.trim()}.` : chunk;
      let result;
      if (lockSpanish) {
        try {
          result = await textToBufferWithTimings(ttsText, voiceId, offsetSec, 'eleven_turbo_v2_5', 'es');
        } catch (e) {
          console.warn('[lesson/audio] language-locked TTS failed, using multilingual:', e instanceof Error ? e.message : e);
          result = await textToBufferWithTimings(ttsText, voiceId, offsetSec);
        }
      } else {
        result = await textToBufferWithTimings(ttsText, voiceId, offsetSec);
      }
      buffers.push(result.buffer);
      allTimings.push(...result.wordTimings);
      offsetSec += result.durationSec;
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

    const result: { audioUrl: string; promptAfter: boolean; text: string; spanishText?: string; wordTimings: WordTiming[]; sectionName?: string }[] = new Array(batch.length);

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
        result[i] = { audioUrl: `/lessons/${filename}`, promptAfter: play.promptAfter, text: play.text, spanishText: play.spanishText, wordTimings, sectionName: play.sectionName };
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
