'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { TutorStrip } from '@/components/ui/tutor-strip';
import { Icons } from '@/components/ui/icons';
import { LESSON } from '@/lib/data';

const META = [
  ['Duration', '25 min'],
  ['Level', 'B1 · normal'],
  ['Scenario', 'Social plans'],
  ['Focus', 'Recent mistakes + speed'],
  ['Grammar', 'vos · near future · object pronouns'],
  ['Speaking / Listening', '60 / 40'],
];

const GOALS = [
  'Asking someone if they want to do something',
  'Responding naturally to casual invitations',
  'Using querés, podés, te pinta',
  'Answering faster after audio prompts',
  'Hearing dale, capaz, bueno without missing a beat',
];

export default function PreviewPage() {
  const [generating, setGenerating] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setGenerating(false), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <BrandBar label="06 Preview" />
      <div className="page-narrow fade-in">
        <button className="btn btn-text small" style={{ marginBottom: 8, paddingLeft: 0 }} onClick={() => router.push('/builder')}>
          <Icons.arrowLeft /> Edit settings
        </button>

        <span className="eyebrow eyebrow-warm">{generating ? 'Generating…' : 'Lesson · ready'}</span>
        <h1 className="h-1" style={{ marginTop: 14, marginBottom: 24, maxWidth: 680 }}>
          {generating
            ? <span className="shimmer" style={{ display: 'inline-block', width: '70%', height: 48, borderRadius: 2 }} />
            : `${LESSON.title}.`}
        </h1>
        {!generating && <p className="lede" style={{ maxWidth: 620, marginBottom: 40 }}>{LESSON.subtitle}.</p>}

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--line)', marginBottom: 40 }}>
          {META.map(([k, v], i) => (
            <div key={k} style={{ padding: '18px 22px', borderTop: i > 1 ? '1px solid var(--line)' : 'none', borderLeft: i % 2 ? '1px solid var(--line)' : 'none' }}>
              <span className="eyebrow">{k}</span>
              <div style={{ marginTop: 6, fontSize: 15, color: 'var(--ink)' }}>
                {generating
                  ? <span className="shimmer" style={{ display: 'inline-block', width: 80, height: 14, borderRadius: 1 }} />
                  : v}
              </div>
            </div>
          ))}
        </div>

        {/* Outline + goals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <span className="eyebrow">Outline</span>
            <ol style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
              {LESSON.outline.map((s, i) => (
                <li key={s.n} className="row gap-4" style={{ padding: '14px 0', borderTop: '1px solid var(--line)', alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)', width: 24 }}>0{s.n}</span>
                  <span className="serif" style={{ fontSize: 18, flex: 1 }}>{s.label}</span>
                  <span className="kicker">~{Math.round(((LESSON.outline[i + 1]?.pct ?? 1) - s.pct) * 25)} min</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <span className="eyebrow">By the end you&rsquo;ll practice</span>
            <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
              {GOALS.map((g, i) => (
                <li key={i} className="row gap-3" style={{ padding: '14px 0', borderTop: '1px solid var(--line)', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--warm)' }}>·</span>
                  <span className="body">{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <TutorStrip>
          <span style={{ color: 'var(--mute)', fontStyle: 'normal', fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 11, letterSpacing: '.06em', marginRight: 8 }}>
            WHY THIS LESSON ·
          </span>
          Built around your recent misses on &ldquo;tenés&rdquo;, slow responses to direct questions, and your custom request to practice social plans.
        </TutorStrip>

        <div className="row gap-3" style={{ marginTop: 40 }}>
          <button className="btn btn-primary btn-lg" disabled={generating} onClick={() => router.push('/player')}>
            <Icons.play /> Start lesson
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => { setGenerating(true); setTimeout(() => setGenerating(false), 1000); }}>
            <Icons.refresh /> Regenerate
          </button>
          <button className="btn btn-text" onClick={() => router.push('/builder')}>Edit settings</button>
          <button className="btn btn-text" style={{ marginLeft: 'auto' }}>Save for later</button>
        </div>
      </div>
    </>
  );
}
