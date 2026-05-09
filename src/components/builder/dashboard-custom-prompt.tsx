'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';

const IDEAS = [
  'Tell my landlord the hot water stopped working',
  'Order at a parrilla in San Telmo',
  'Make plans to watch Boca with friends',
  'Argue with a taxi driver about the route',
];

export function DashboardCustomPrompt() {
  const [v, setV] = useState('');
  const setBuilder = useAppStore((s) => s.setBuilder);
  const router = useRouter();

  const submit = () => {
    if (!v.trim()) return;
    setBuilder({ custom: v, scenario: 'auto', focus: 'auto' });
    router.push('/preview');
  };

  return (
    <div style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', borderRadius: 4, padding: '18px 20px' }}>
      <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
        <span className="mate-icon" style={{ marginTop: 8 }} />
        <textarea
          className="textarea"
          placeholder="Describe a real situation in your own words. e.g. I'm at a kiosco trying to pay with a 1000-peso bill but they don't have change."
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          style={{ flex: 1, background: 'transparent', border: 0, padding: 0, minHeight: 60, fontFamily: 'var(--font-newsreader), serif', fontSize: 18, fontStyle: 'italic', color: 'var(--ink)' }}
        />
        <button className="btn btn-primary btn-sm" disabled={!v.trim()} onClick={submit}>
          <Icons.spark /> Generate
        </button>
      </div>
      <div className="row gap-2" style={{ marginTop: 14, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <span className="kicker" style={{ alignSelf: 'center', marginRight: 4 }}>TRY ·</span>
        {IDEAS.map((idea) => (
          <button key={idea} className="chip" onClick={() => setV(idea)} style={{ borderStyle: 'dashed' }}>
            {idea}
          </button>
        ))}
      </div>
    </div>
  );
}
