'use client';
import { useState } from 'react';

interface ToggleProps {
  value: boolean;
  onChange?: (v: boolean) => void;
}

export function Toggle({ value: initial, onChange }: ToggleProps) {
  const [on, setOn] = useState(initial);
  const toggle = () => { setOn((o) => { onChange?.(!o); return !o; }); };

  return (
    <button
      onClick={toggle}
      style={{
        width: 40, height: 22, borderRadius: 999,
        background: on ? 'var(--ink)' : 'var(--bg-3)',
        border: '1px solid var(--line-2)',
        position: 'relative', cursor: 'pointer', padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 1,
          left: on ? 19 : 1,
          width: 18, height: 18, borderRadius: '50%',
          background: on ? '#100e0c' : 'var(--mute)',
          transition: 'all .18s',
        }}
      />
    </button>
  );
}
