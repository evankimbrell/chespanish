'use client';

const STEPS = [-3, -2, -1, 0, 1, 2, 3] as const;
type Step = typeof STEPS[number];

interface DifficultySliderProps {
  value: number;
  onChange: (v: number) => void;
  levelOf: (n: number) => string;
  labelOf: (n: number) => string;
}

export function DifficultySlider({ value, onChange, levelOf, labelOf }: DifficultySliderProps) {
  const idx = STEPS.indexOf(value as Step);
  const pct = (idx / (STEPS.length - 1)) * 100;

  return (
    <div className="col gap-3" style={{ paddingTop: 6 }}>
      <div style={{ position: 'relative', height: 48 }}>
        {/* track */}
        <div style={{ position: 'absolute', top: 23, left: 0, right: 0, height: 2, background: 'var(--line)' }} />
        <div style={{ position: 'absolute', top: 23, left: 0, width: `${pct}%`, height: 2, background: 'var(--ink)' }} />

        {/* dots */}
        {STEPS.map((s, i) => {
          const left = (i / (STEPS.length - 1)) * 100;
          const active = s === value;
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              title={levelOf(s)}
              style={{
                position: 'absolute',
                top: active ? 14 : 18,
                left: `calc(${left}% - 10px)`,
                width: 20,
                height: active ? 20 : 12,
                borderRadius: '50%',
                background: active ? 'var(--warm)' : (i <= idx ? 'var(--ink-2)' : 'var(--bg-3)'),
                border: '2px solid var(--bg)',
                cursor: 'pointer',
                padding: 0,
                transition: 'all .15s',
              }}
            />
          );
        })}

        {/* center label */}
        <div style={{ position: 'absolute', top: -2, left: `calc(${pct}% - 50px)`, width: 100, textAlign: 'center', pointerEvents: 'none' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--mute)' }}>{labelOf(value)}</div>
        </div>
      </div>

      <div className="row between" style={{ padding: '0 4px' }}>
        <span className="kicker">A2.7 · easier</span>
        <span className="serif" style={{ fontSize: 32, fontStyle: 'italic', color: 'var(--warm)', letterSpacing: '-.01em', lineHeight: 1 }}>{levelOf(value)}</span>
        <span className="kicker" style={{ textAlign: 'right' }}>harder · B1.3</span>
      </div>
    </div>
  );
}
