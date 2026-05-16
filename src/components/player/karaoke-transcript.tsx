'use client';
import { useMemo } from 'react';

const CHUNK_SIZE = 15;

interface Props {
  text: string;
  audioProgress: number; // 0–1 within current play
}

function cleanText(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function KaraokeTranscript({ text, audioProgress }: Props) {
  const words = useMemo(() => cleanText(text).split(/\s+/).filter(Boolean), [text]);
  const chunks = useMemo<string[][]>(() => {
    const out: string[][] = [];
    for (let i = 0; i < words.length; i += CHUNK_SIZE) out.push(words.slice(i, i + CHUNK_SIZE));
    return out;
  }, [words]);

  const n = chunks.length || 1;
  const chunkIdx = Math.min(Math.floor(audioProgress * n), n - 1);
  const chunk = chunks[chunkIdx] ?? [];

  const chunkStart = chunkIdx / n;
  const chunkEnd = (chunkIdx + 1) / n;
  const within = chunkEnd > chunkStart
    ? Math.min(Math.max((audioProgress - chunkStart) / (chunkEnd - chunkStart), 0), 1)
    : 0;
  const activeWordIdx = Math.floor(within * chunk.length);

  if (!chunk.length) return null;

  return (
    <div
      className="fade-in"
      style={{
        marginTop: 16, padding: '24px 32px',
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
              color: i < activeWordIdx
                ? 'rgba(212,165,116,0.65)'
                : i === activeWordIdx
                  ? 'var(--ink)'
                  : 'rgba(255,255,255,0.15)',
              fontWeight: i === activeWordIdx ? 600 : 400,
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
        {chunkIdx + 1} / {n}
      </span>
    </div>
  );
}
