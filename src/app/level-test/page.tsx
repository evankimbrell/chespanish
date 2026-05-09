'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Wave } from '@/components/ui/wave';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';

const TOTAL = 12;

export default function LevelTestPage() {
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);
  const [showText, setShowText] = useState(false);
  const router = useRouter();

  const record = () => {
    setRecording(true);
    setTimeout(() => { setRecording(false); setDone(true); }, 2200);
  };

  const next = () => {
    setDone(false); setShowText(false);
    if (step < TOTAL - 1) setStep((s) => s + 1);
    else router.push('/level-result');
  };

  return (
    <>
      <BrandBar label="02 Level test" />
      <div className="page-narrow fade-in">
        <div className="row between" style={{ marginBottom: 48 }}>
          <div className="col gap-2">
            <span className="eyebrow">Level Test</span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--mute)' }}>
              {String(step + 1).padStart(2, '0')} / {TOTAL}
            </span>
          </div>
          <button className="btn btn-text small" onClick={() => router.push('/welcome')}>Exit test</button>
        </div>

        <div className="progress" style={{ marginBottom: 64 }}>
          <div className="progress-fill" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
        </div>

        <div className="col gap-8" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="eyebrow eyebrow-warm">Prompt · listen and respond</span>

          <div className="col gap-6" style={{ alignItems: 'center' }}>
            <div className="row gap-4" style={{ alignItems: 'center' }}>
              <button className="btn btn-icon btn-ghost" style={{ width: 64, height: 64, borderRadius: '50%' }}>
                <Icons.play />
              </button>
              <Wave count={48} height={44} />
              <span className="mono small">0:08</span>
            </div>

            {showText && (
              <p className="serif" style={{ fontSize: 32, letterSpacing: '-.01em', maxWidth: 680, fontStyle: 'italic' }}>
                &ldquo;¿Querés tomar algo antes de ir?&rdquo;
              </p>
            )}
            <button className="btn btn-text small" onClick={() => setShowText((s) => !s)}>
              {showText ? 'Hide text' : 'Show text'}
            </button>
          </div>

          <p className="lede" style={{ maxWidth: 520 }}>
            A friend just asked you something. Respond naturally in Spanish.
          </p>

          <div className="col gap-4" style={{ alignItems: 'center', marginTop: 16 }}>
            <button
              className={'mic-btn' + (recording ? ' recording' : '')}
              disabled={done}
              onClick={record}
            >
              <Icons.mic />
            </button>
            <span className="mono small" style={{ color: recording ? 'var(--crit)' : 'var(--mute)' }}>
              {recording ? '● RECORDING · 00:02' : done ? 'Response captured' : 'Tap to respond'}
            </span>
          </div>

          {done && (
            <div className="card fade-in" style={{ maxWidth: 560, width: '100%', textAlign: 'left' }}>
              <span className="eyebrow">You said</span>
              <p className="serif" style={{ fontSize: 22, marginTop: 8, fontStyle: 'italic' }}>
                &ldquo;Sí, vamos a tomar un café.&rdquo;
              </p>
              <hr className="divider" style={{ margin: '14px 0' }} />
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                <Tag kind="leaf">● Good</Tag>
                <span className="small">Marked for review · feedback after the test.</span>
              </div>
            </div>
          )}

          <div className="row gap-3">
            <button className="btn btn-ghost" onClick={() => { setRecording(false); setDone(false); }}>Skip</button>
            <button className="btn btn-primary" disabled={!done} onClick={next}>
              Continue <Icons.arrow />
            </button>
          </div>

          <div className="row gap-3" style={{ marginTop: 24, padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, maxWidth: 520 }}>
            <span className="mate-icon" style={{ marginTop: 4 }} />
            <span className="small" style={{ textAlign: 'left' }}>
              Brief feedback only during the test. We&rsquo;ll save corrections and show a full profile at the end.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
