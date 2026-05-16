'use client';
import { useMemo, useRef, useState } from 'react';
import { Icons } from '@/components/ui/icons';
import { Tag } from '@/components/ui/tag';
import type { PlayerState } from '@/lib/types';

interface Section {
  id: number;
  label: string;
  pct: number;
  end: number;
}

interface Prompt {
  id: number;
  t: number;
}

interface OrbWithSectionsProps {
  progress: number;
  sections: Section[];
  prompts: Prompt[];
  active: boolean;
  accent: boolean;
  hoverSection: number | null;
  setHoverSection: (id: number | null) => void;
  onSeek: (t: number) => void;
  state: PlayerState;
  onPlay: () => void;
  onPause: () => void;
  onRecord: () => void;
}

const SIZE = 380;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 142;
const LABEL_R = 175;
const N_BARS = 72;
const RING_HIT = 24; // px tolerance around ring for drag activation

function angleAt(t: number) {
  return t * 2 * Math.PI - Math.PI / 2;
}

function progressFromAngle(angle: number) {
  const adjusted = ((angle + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return adjusted / (2 * Math.PI);
}

function fmtTime(t: number) {
  const totalSec = Math.round(t * 25 * 60);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
}

export function OrbWithSections({
  progress, sections, prompts, active, accent,
  hoverSection, setHoverSection, onSeek, state, onPlay, onPause, onRecord,
}: OrbWithSectionsProps) {
  const bars = useMemo(
    () => Array.from({ length: N_BARS }, (_, i) => 0.4 + Math.abs(Math.sin(i * 0.4)) * 0.6),
    []
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  function progressFromPointer(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const dx = px - CX, dy = py - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(dist - R) > RING_HIT) return null;
    return progressFromAngle(Math.atan2(dy, dx));
  }

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const t = progressFromPointer(e);
    if (t === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragProgress(t);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragProgress === null) return;
    const t = progressFromPointer(e);
    if (t !== null) setDragProgress(t);
  };

  const onSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragProgress === null) return;
    const t = progressFromPointer(e) ?? dragProgress;
    setDragProgress(null);
    onSeek(t);
  };

  const displayProgress = dragProgress ?? progress;

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
      {/* Soft warm halo */}
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,165,116,.22), rgba(212,165,116,0) 65%)',
          animation: active ? 'pulse-warm 2.4s ease-in-out infinite' : 'none',
        }}
      />

      <svg
        ref={svgRef}
        width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position: 'absolute', inset: 0, cursor: dragProgress !== null ? 'grabbing' : 'default' }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
      >
        {/* Outer ring */}
        <circle cx={CX} cy={CY} r={LABEL_R} fill="none" stroke="var(--line)" strokeWidth="1" />
        {/* Inner ring */}
        <circle cx={CX} cy={CY} r={R - 12} fill="none" stroke="var(--line)" strokeWidth="1" />

        {/* Section arcs */}
        {sections.map((s) => {
          const a1 = angleAt(s.pct);
          const a2 = angleAt(s.end);
          const x1 = CX + Math.cos(a1) * R, y1 = CY + Math.sin(a1) * R;
          const x2 = CX + Math.cos(a2) * R, y2 = CY + Math.sin(a2) * R;
          const largeArc = (s.end - s.pct) > 0.5 ? 1 : 0;
          const isActive = displayProgress >= s.pct && displayProgress < s.end;
          const isHover = hoverSection === s.id;
          const isPast = displayProgress >= s.end;

          return (
            <path
              key={s.id}
              d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none"
              stroke={isActive || isHover ? 'var(--warm)' : isPast ? 'var(--ink-2)' : 'var(--line-2)'}
              strokeWidth={isActive || isHover ? 4 : 2}
              strokeLinecap="round"
              style={{ transition: 'all .2s', cursor: 'pointer' }}
              onMouseEnter={() => setHoverSection(s.id)}
              onMouseLeave={() => setHoverSection(null)}
              onClick={() => dragProgress === null && onSeek(s.pct + 0.001)}
            />
          );
        })}

        {/* Prompt dots */}
        {prompts.map((pr) => {
          const a = angleAt(pr.t);
          const x = CX + Math.cos(a) * R, y = CY + Math.sin(a) * R;
          const done = displayProgress >= pr.t;
          return (
            <g key={pr.id}>
              <circle cx={x} cy={y} r={2} fill="var(--bg)" stroke={done ? 'var(--warm)' : 'var(--mute-2)'} strokeWidth="1" />
              {done && <circle cx={x} cy={y} r={1} fill="var(--warm)" />}
            </g>
          );
        })}

        {/* Progress head */}
        {(() => {
          const a = angleAt(Math.max(0.001, displayProgress));
          const x = CX + Math.cos(a) * R, y = CY + Math.sin(a) * R;
          const isDragging = dragProgress !== null;
          return (
            <g>
              <circle
                cx={x} cy={y} r={isDragging ? 9 : 6}
                fill="var(--ink)"
                style={{ cursor: 'grab', transition: isDragging ? 'none' : 'r .1s' }}
              />
              {isDragging && (
                <text
                  x={x} y={y - 16}
                  textAnchor="middle" fontSize="11"
                  fill="var(--ink)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {fmtTime(dragProgress)}
                </text>
              )}
            </g>
          );
        })()}

        {/* Audio bars */}
        {bars.map((h, i) => {
          const angle = (i / N_BARS) * Math.PI * 2 - Math.PI / 2;
          const r1 = R - 32;
          const r2 = r1 + h * (active ? 22 : 6);
          const x1 = CX + Math.cos(angle) * r1, y1 = CY + Math.sin(angle) * r1;
          const x2 = CX + Math.cos(angle) * r2, y2 = CY + Math.sin(angle) * r2;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={accent ? 'var(--crit)' : 'var(--ink-2)'}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={active ? 0.6 : 0.3}
              style={{ transition: 'all .25s', transitionDelay: `${i * 4}ms` }}
            />
          );
        })}
      </svg>

      {/* Section labels around the perimeter */}
      {sections.map((s) => {
        const midT = (s.pct + s.end) / 2;
        const a = angleAt(midT);
        const outR = LABEL_R + 20;
        const lx = CX + Math.cos(a) * outR;
        const ly = CY + Math.sin(a) * outR;
        const alignRight = lx < CX - 4;
        const isActive = displayProgress >= s.pct && displayProgress < s.end;
        const isHover = hoverSection === s.id;

        return (
          <button
            key={s.id}
            onMouseEnter={() => setHoverSection(s.id)}
            onMouseLeave={() => setHoverSection(null)}
            onClick={() => onSeek(s.pct + 0.001)}
            style={{
              position: 'absolute',
              left: alignRight ? 'auto' : lx,
              right: alignRight ? SIZE - lx : 'auto',
              top: ly,
              transform: 'translateY(-50%)',
              background: 'transparent', border: 0, cursor: 'pointer', padding: '4px 6px',
              textAlign: alignRight ? 'right' : 'left',
              whiteSpace: 'nowrap',
              opacity: isActive || isHover ? 1 : 0.55,
              transition: 'opacity .15s',
            }}
          >
            <span className="mono" style={{ fontSize: 10, letterSpacing: '.08em', color: isActive ? 'var(--warm)' : 'var(--mute)', display: 'block' }}>
              {String(s.id).padStart(2, '0')}
            </span>
            <span className="serif" style={{ fontSize: 14, color: isActive || isHover ? 'var(--ink)' : 'var(--ink-2)', display: 'block' }}>
              {s.label}
            </span>
          </button>
        );
      })}

      {/* Center control */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        {(state === 'playing' || state === 'idle') && (
          <button
            className="btn btn-icon"
            style={{
              pointerEvents: 'auto', width: 84, height: 84, borderRadius: '50%',
              background: 'var(--ink)', color: '#100e0c', border: 0,
              boxShadow: '0 8px 32px rgba(0,0,0,.5)',
            }}
            onClick={state === 'playing' ? onPause : onPlay}
          >
            {state === 'playing' ? <Icons.pause /> : <Icons.play />}
          </button>
        )}
        {state === 'prompting' && (
          <button className="mic-btn" style={{ pointerEvents: 'auto', width: 96, height: 96 }} onClick={onRecord}>
            <Icons.mic />
          </button>
        )}
        {state === 'recording' && (
          <button className="mic-btn recording" style={{ pointerEvents: 'auto', width: 96, height: 96 }} onClick={onRecord}>
            <Icons.mic />
          </button>
        )}
        {state === 'processing' && (
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        )}
        {(state === 'asking' || state === 'answering') && (
          <div className="col center gap-2" style={{ textAlign: 'center' }}>
            <Icons.spark style={{ color: 'var(--warm)', width: 24, height: 24 }} />
            <span className="kicker eyebrow-warm">{state === 'asking' ? 'PAUSED · ASK' : 'ANSWERING'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
