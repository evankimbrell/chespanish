'use client';
import { useState } from 'react';
import { Icons } from '@/components/ui/icons';
import type { FakePlayer } from './use-fake-player';

const QUICK_ASKS = [
  'What did she just say?',
  'Why "vos" and not "tú"?',
  'When do I use "dale"?',
];

export function AskOverlay({ p }: { p: FakePlayer }) {
  const [q, setQ] = useState('');

  if (p.state !== 'asking' && p.state !== 'answering') return null;

  return (
    <div
      className="fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(10,9,8,.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div className="card" style={{ maxWidth: 640, width: '100%', padding: 32, position: 'relative' }}>
        <div className="row between" style={{ alignItems: 'baseline', marginBottom: 16 }}>
          <span className="eyebrow eyebrow-warm">● PAUSED · ASK YOUR TUTOR</span>
          <span className="kicker">audio resumes after</span>
        </div>

        {p.state === 'asking' && (
          <div className="col gap-4">
            <h2 className="h-3">What do you want to know?</h2>
            <textarea
              autoFocus
              className="textarea"
              placeholder={'e.g. "Why did she say “dale” there?" or "What’s the difference between “porque” and “por qué”?"'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minHeight: 96, fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', fontSize: 18 }}
            />
            <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
              <span className="kicker" style={{ alignSelf: 'center', marginRight: 4 }}>QUICK ASKS ·</span>
              {QUICK_ASKS.map((s) => (
                <button key={s} className="chip" style={{ borderStyle: 'dashed' }} onClick={() => setQ(s)}>{s}</button>
              ))}
            </div>
            <div className="row gap-2" style={{ marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => { setQ(''); p.submitQuestion(); }}>Cancel</button>
              <button className="btn btn-primary" disabled={!q.trim()} onClick={p.submitQuestion} style={{ marginLeft: 'auto' }}>
                <Icons.spark /> Ask
              </button>
            </div>
          </div>
        )}

        {p.state === 'answering' && (
          <div className="col gap-4 fade-in">
            <span className="eyebrow">YOU ASKED</span>
            <p className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink-2)' }}>
              &ldquo;{q || 'What did she just say?'}&rdquo;
            </p>
            <hr className="divider" />
            <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <span className="brand-mark" style={{ marginTop: 4 }} />
              <div className="col gap-2" style={{ flex: 1 }}>
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                  <span className="spinner" />
                  <span className="small">Tutor is answering…</span>
                </div>
                <p className="serif" style={{ fontSize: 18, fontStyle: 'italic', color: 'var(--ink-2)' }}>
                  &ldquo;She said <span style={{ color: 'var(--warm)' }}>&lsquo;te pinta&rsquo;</span> — it&rsquo;s a casual way to ask if you feel like doing something. Closer to <span style={{ color: 'var(--ink)' }}>&lsquo;are you up for it?&rsquo;</span> than &lsquo;do you want to.&rsquo; You&rsquo;ll hear it constantly with friends.&rdquo;
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
