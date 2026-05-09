'use client';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Icons } from '@/components/ui/icons';

export default function WelcomePage() {
  const router = useRouter();

  return (
    <>
      <BrandBar label="01 Welcome" />
      <div
        className="page fade-in"
        style={{
          paddingTop: 0, paddingBottom: 0,
          minHeight: 'calc(100vh - 60px)',
          display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 64, alignItems: 'center',
        }}
      >
        {/* Left column */}
        <div className="col gap-8" style={{ maxWidth: 560 }}>
          <div className="col gap-4">
            <span className="eyebrow">Audio-first Spanish · Buenos Aires</span>
            <h1 className="h-display">
              Practice Spanish<br />by <em>speaking</em> it.
            </h1>
            <p className="lede" style={{ maxWidth: 480, marginTop: 8 }}>
              An audio tutor that knows your level, remembers what you struggle with, and helps you sound like you actually live in Buenos Aires.
            </p>
          </div>

          <div className="row gap-3">
            <button className="btn btn-primary btn-lg" onClick={() => router.push('/level-test')}>
              Test my level <Icons.arrow />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => router.push('/dashboard')}>
              Continue
            </button>
          </div>

          <div className="row gap-6" style={{ marginTop: 8 }}>
            <div className="col gap-1">
              <span className="eyebrow">Default</span>
              <span className="small" style={{ color: 'var(--ink-2)' }}>Rioplatense (vos)</span>
            </div>
            <div className="divider-v" />
            <div className="col gap-1">
              <span className="eyebrow">Session</span>
              <span className="small" style={{ color: 'var(--ink-2)' }}>20–30 min · daily</span>
            </div>
            <div className="divider-v" />
            <div className="col gap-1">
              <span className="eyebrow">Method</span>
              <span className="small" style={{ color: 'var(--ink-2)' }}>Listen · respond · review</span>
            </div>
          </div>
        </div>

        {/* Right column — tutor portrait placeholder */}
        <div style={{ position: 'relative', aspectRatio: '4/5', maxHeight: 680, width: '100%' }}>
          <div
            className="placeholder-stripes"
            style={{ width: '100%', height: '100%', borderRadius: 2 }}
          >
            <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 12px', background: 'var(--bg)', borderRadius: 3 }}>
              Tutor portrait — drop a photo
            </span>
          </div>

          {/* Quote card */}
          <div
            style={{
              position: 'absolute', left: -24, bottom: 32,
              background: 'var(--bg)', border: '1px solid var(--line)',
              padding: '14px 18px', maxWidth: 280,
              fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', fontSize: 18, lineHeight: 1.35,
            }}
          >
            <span style={{ color: 'var(--warm)' }}>&ldquo;</span>
            Dale, sentate. Empezamos cuando estés listo.
            <span style={{ color: 'var(--warm)' }}>&rdquo;</span>
            <div className="kicker" style={{ marginTop: 8, fontStyle: 'normal' }}>— your tutor</div>
          </div>

          {/* Live badge */}
          <div
            style={{
              position: 'absolute', top: 24, right: 24,
              padding: '6px 10px',
              background: 'rgba(10,9,8,.7)', backdropFilter: 'blur(8px)',
              border: '1px solid var(--line)', borderRadius: 3,
            }}
          >
            <span className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--mute)' }}>● LIVE TUTOR · 00:00</span>
          </div>
        </div>
      </div>
    </>
  );
}
