'use client';

interface ScrubberProps {
  progress: number;
  markers?: { t: number; label?: string }[];
  onSeek?: (t: number) => void;
}

export function Scrubber({ progress, markers = [], onSeek }: ScrubberProps) {
  return (
    <div
      style={{ position: 'relative', height: 24, cursor: onSeek ? 'pointer' : 'default' }}
      onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek((e.clientX - r.left) / r.width);
      }}
    >
      <div className="progress" style={{ position: 'absolute', top: 11, left: 0, right: 0 }}>
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      {markers.map((m, i) => (
        <div
          key={i}
          title={m.label}
          style={{
            position: 'absolute', top: 6, left: `${m.t * 100}%`,
            width: 1, height: 12,
            background: m.t <= progress ? 'var(--ink)' : 'var(--mute-2)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute', top: 7, left: `${progress * 100}%`,
          width: 10, height: 10, borderRadius: '50%', background: 'var(--ink)',
          transform: 'translateX(-50%)', boxShadow: '0 0 0 4px rgba(245,241,232,.1)',
        }}
      />
    </div>
  );
}
