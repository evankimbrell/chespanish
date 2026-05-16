'use client';
import { useRef, useState, useCallback } from 'react';

interface ScrubberProps {
  progress: number;
  markers?: { t: number; label?: string }[];
  onSeek?: (t: number) => void;
}

function fmtTime(t: number) {
  const totalSec = Math.round(t * 25 * 60);
  const m = Math.floor(totalSec / 60);
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function Scrubber({ progress, markers = [], onSeek }: ScrubberProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragT, setDragT] = useState<number | null>(null);

  const tFromPointer = useCallback((clientX: number) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r) return null;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!onSeek) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = tFromPointer(e.clientX);
    if (t !== null) setDragT(t);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragT === null) return;
    const t = tFromPointer(e.clientX);
    if (t !== null) setDragT(t);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragT === null) return;
    const t = tFromPointer(e.clientX) ?? dragT;
    setDragT(null);
    onSeek?.(t);
  };

  const display = dragT ?? progress;

  return (
    <div
      ref={barRef}
      style={{ position: 'relative', height: 24, cursor: onSeek ? 'pointer' : 'default', userSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="progress" style={{ position: 'absolute', top: 11, left: 0, right: 0 }}>
        <div className="progress-fill" style={{ width: `${display * 100}%` }} />
      </div>
      {markers.map((m, i) => (
        <div
          key={i}
          title={m.label}
          style={{
            position: 'absolute', top: 6, left: `${m.t * 100}%`,
            width: 1, height: 12,
            background: m.t <= display ? 'var(--ink)' : 'var(--mute-2)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute', top: 7, left: `${display * 100}%`,
          width: 10, height: 10, borderRadius: '50%', background: 'var(--ink)',
          transform: 'translateX(-50%)', boxShadow: '0 0 0 4px rgba(245,241,232,.1)',
        }}
      />
      {dragT !== null && (
        <div style={{
          position: 'absolute', bottom: 20, left: `${dragT * 100}%`,
          transform: 'translateX(-50%)',
          background: 'var(--bg-2)', border: '1px solid var(--line)',
          borderRadius: 4, padding: '2px 6px',
          fontSize: 11, fontFamily: 'monospace', color: 'var(--ink)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {fmtTime(dragT)}
        </div>
      )}
    </div>
  );
}
