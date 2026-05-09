'use client';
import { useState } from 'react';

interface SegmentedProps {
  options: string[];
  value: string;
  suffix?: string;
  onChange?: (v: string) => void;
}

export function Segmented({ options, value: initial, suffix = '', onChange }: SegmentedProps) {
  const [v, setV] = useState(initial);
  const select = (o: string) => { setV(o); onChange?.(o); };

  return (
    <div className="row" style={{ border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
      {options.map((o, i) => (
        <button
          key={o}
          onClick={() => select(o)}
          style={{
            padding: '8px 14px',
            background: o === v ? 'var(--ink)' : 'transparent',
            color: o === v ? '#100e0c' : 'var(--ink-2)',
            border: 0,
            borderLeft: i ? '1px solid var(--line)' : 0,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {o}{suffix}
        </button>
      ))}
    </div>
  );
}
