'use client';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';

const STRONG = [
  'Restaurant and café phrases',
  'Numbers, time, directions',
  'Short comprehension at slow speed',
  'Polite small talk',
];

const NEEDS_WORK = [
  'Vos forms (tenés / querés / podés)',
  'Faster responses to open prompts',
  'Object pronouns in casual speech',
  'Understanding natural-speed audio',
];

export default function LevelResultPage() {
  const router = useRouter();

  return (
    <>
      <BrandBar label="03 Level result" />
      <div className="page-narrow fade-in">
        <div className="col gap-12">
          <div className="col gap-3">
            <span className="eyebrow">Level test complete · 12 prompts</span>
            <h1 className="h-display">Your level is <em>B1.</em></h1>
            <p className="lede" style={{ maxWidth: 560 }}>
              You can handle simple conversations and follow most everyday audio. Your spoken responses lag and you still slip into{' '}
              <span style={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic' }}>tú</span> forms.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--line)' }}>
            {[
              { eb: 'Strong with', items: STRONG, warm: false },
              { eb: 'Needs work',  items: NEEDS_WORK, warm: true  },
            ].map((col, i) => (
              <div key={i} style={{ padding: '28px 28px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
                <span className={'eyebrow' + (col.warm ? ' eyebrow-warm' : '')}>{col.eb}</span>
                <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
                  {col.items.map((item, j) => (
                    <li key={j} className="row gap-3" style={{ padding: '10px 0', borderTop: j ? '1px solid var(--line)' : 'none', alignItems: 'baseline' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)', width: 24 }}>{String(j + 1).padStart(2, '0')}</span>
                      <span className="serif" style={{ fontSize: 18, color: col.warm ? 'var(--ink)' : 'var(--ink-2)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 32 }}>
            <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
              <span className="eyebrow eyebrow-warm">Recommended first lesson</span>
              <Tag kind="warm">Personalized</Tag>
            </div>
            <h2 className="h-2" style={{ marginBottom: 10 }}>Making plans with a friend.</h2>
            <p className="body" style={{ maxWidth: 620 }}>
              Casual invitations, near-future (&ldquo;voy a&rdquo;), and the vos forms you missed. About 25 minutes of audio practice.
            </p>
            <div className="row gap-3" style={{ marginTop: 24 }}>
              <button className="btn btn-warm" onClick={() => router.push('/preview')}>
                Start recommended lesson <Icons.arrow />
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>Go to dashboard</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
