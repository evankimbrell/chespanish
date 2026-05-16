'use client';
import { useMemo } from 'react';
import type { WordTiming } from '@/lib/types';

const CHUNK_SIZE = 15;

interface Props {
  text: string;
  audioProgress: number; // 0–1 fallback when no wordTimings
  currentTime?: number;  // seconds from audio element
  wordTimings?: WordTiming[];
}

function cleanText(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function KaraokeTranscript({ text, audioProgress, currentTime, wordTimings }: Props) {
  const hasTimings = !!wordTimings && wordTimings.length > 0 && currentTime !== undefined;

  // Binary search: last index where wordTimings[i].start <= currentTime
  const activeWordIdxFromTimings = useMemo(() => {
    if (!hasTimings || !wordTimings || currentTime === undefined) return null;
    let lo = 0, hi = wordTimings.length - 1, result = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (wordTimings[mid].start <= currentTime) { result = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return result;
  }, [wordTimings, currentTime, hasTimings]);

  // Words list — from timings or from cleaned text
  const words = useMemo(() => {
    if (hasTimings && wordTimings) return wordTimings.map((wt) => wt.word);
    return cleanText(text).split(/\s+/).filter(Boolean);
  }, [text, wordTimings, hasTimings]);

  const totalWords = words.length;

  // Active word index — real timestamps or proportional fallback
  const activeWordIdx = hasTimings
    ? (activeWordIdxFromTimings ?? 0)
    : Math.floor(audioProgress * totalWords);

  // Which 15-word chunk contains the active word
  const chunkIdx = Math.floor(activeWordIdx / CHUNK_SIZE);
  const totalChunks = Math.ceil(totalWords / CHUNK_SIZE) || 1;
  const chunkStart = chunkIdx * CHUNK_SIZE;
  const chunk = words.slice(chunkStart, chunkStart + CHUNK_SIZE);
  const localActiveIdx = activeWordIdx - chunkStart;

  if (!chunk.length) return null;

  return (
    <div
      className="fade-in"
      style={{
        marginTop: 24, padding: '24px 32px',
        background: 'rgba(10,9,8,.85)', backdropFilter: 'blur(12px)',
        border: '1px solid var(--line)', borderRadius: 6,
        maxWidth: 700, textAlign: 'center',
      }}
    >
      <p className="serif" style={{ fontSize: 22, lineHeight: 1.75, margin: 0 }}>
        {chunk.map((word, i) => (
          <span
            key={i}
            style={{
              color: i < localActiveIdx
                ? 'rgba(212,165,116,0.65)'
                : i === localActiveIdx
                  ? 'var(--ink)'
                  : 'rgba(255,255,255,0.15)',
              fontWeight: i === localActiveIdx ? 600 : 400,
              transition: 'color 0.08s',
              marginRight: i < chunk.length - 1 ? '0.3em' : 0,
              display: 'inline-block',
            }}
          >
            {word}
          </span>
        ))}
      </p>
      <span style={{ fontSize: 11, color: 'var(--mute-2)', marginTop: 8, display: 'block', letterSpacing: '.06em' }}>
        {chunkIdx + 1} / {totalChunks}
      </span>
    </div>
  );
}
