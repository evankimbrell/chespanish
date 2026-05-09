'use client';
import { useMemo } from 'react';

interface WaveProps {
  playing?: boolean;
  count?: number;
  height?: number;
}

export function Wave({ playing = false, count = 28, height = 28 }: WaveProps) {
  const bars = useMemo(
    () => Array.from({ length: count }, (_, i) => 0.35 + Math.abs(Math.sin(i * 0.7)) * 0.65),
    [count]
  );

  return (
    <div className={'wave' + (playing ? ' playing' : '')} style={{ height }}>
      {bars.map((h, i) => (
        <span key={i} style={{ height: `${h * 100}%`, animationDelay: `${i * 0.04}s` }} />
      ))}
    </div>
  );
}
