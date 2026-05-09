import { ReactNode } from 'react';

export function TutorStrip({ children }: { children: ReactNode }) {
  return (
    <div className="row gap-3" style={{ alignItems: 'center', padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4 }}>
      <span className="mate-icon" />
      <span className="small" style={{ color: 'var(--ink-2)', fontStyle: 'italic', fontFamily: 'var(--font-newsreader), serif' }}>
        {children}
      </span>
    </div>
  );
}
