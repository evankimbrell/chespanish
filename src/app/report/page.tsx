'use client';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { TutorStrip } from '@/components/ui/tutor-strip';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { LESSON } from '@/lib/data';

const STATS = [
  ['Score', '88', 'of 100'],
  ['Time', '27 min', 'vs 25 estimated'],
  ['Avg response', '5.2s', 'target 4.0s'],
  ['Mistakes', '6', '3 new · 3 recurring'],
];

const MISSES = [
  { name: 'Used "tienes" instead of "tenés"', cat: 'Conjugation', sev: 'high', t: '04:12', user: '¿Tienes tiempo mañana?', right: '¿Tenés tiempo mañana?' },
  { name: 'Confused "me traés" with "me das"', cat: 'Naturalness', sev: 'med', t: '09:48', user: '¿Me das un café?', right: '¿Me traés un café?' },
  { name: 'Slow response to future-tense prompt', cat: 'Speed', sev: 'med', t: '14:33', user: '(8.4 sec hesitation)', right: 'Voy a ir mañana.' },
  { name: 'Misheard "capaz"', cat: 'Listening', sev: 'low', t: '19:06', user: '(asked tutor to repeat)', right: 'capaz = "maybe"' },
];

const WENT_WELL = [
  'Understanding café and restaurant phrases',
  'Responding naturally to simple questions',
  'Using "quiero" and "dale" correctly',
  'Recovering after corrections without freezing',
];

const CONCEPTS = [
  ['Asking for things', 'Highest-frequency pattern in service interactions.'],
  ['Vos form of tener', 'You hear "tenés" constantly. It is the everyday form.'],
  ['Casual "te pinta"', 'Lets you sound natural with friends without slang overload.'],
  ['Near future "voy a"', 'Replaces the simple future in spoken Argentine.'],
];

export default function ReportPage() {
  const router = useRouter();

  return (
    <>
      <TopNav />
      <div className="page-narrow fade-in">
        <span className="eyebrow eyebrow-warm">Lesson complete · 100%</span>
        <h1 className="ty-h1" style={{ marginTop: 14, marginBottom: 18 }}>{LESSON.title}.</h1>
        <p className="lede" style={{ maxWidth: 560 }}>
          You finished in 27 minutes. Most prompts were natural; a few still slipped into{' '}
          <span className="serif" style={{ fontStyle: 'italic' }}>tú</span> forms.
        </p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, border: '1px solid var(--line)', marginTop: 40, marginBottom: 48 }}>
          {STATS.map(([k, v, s], i) => (
            <div key={k} style={{ padding: '24px 24px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
              <span className="eyebrow">{k}</span>
              <div className="serif" style={{ fontSize: 42, marginTop: 8, letterSpacing: '-.015em' }}>{v}</div>
              <span className="kicker">{s}</span>
            </div>
          ))}
        </div>

        {/* Mistakes */}
        <SectionHead num="01 / Misses" title="Where you slipped." sub="Each is now in your Mistakes log. Tap to replay the exact moment or generate a drill." />
        <div className="col" style={{ border: '1px solid var(--line)', marginBottom: 48 }}>
          {MISSES.map((m, i) => (
            <div
              key={i}
              style={{ padding: '20px 24px', borderTop: i ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
              className="card-hover"
              onClick={() => router.push('/mistakes/m1')}
            >
              <div className="row between" style={{ alignItems: 'baseline', marginBottom: 8 }}>
                <div className="row gap-3" style={{ alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)', width: 36 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="serif" style={{ fontSize: 19 }}>{m.name}</span>
                </div>
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                  <Tag kind={m.sev === 'high' ? 'crit' : m.sev === 'med' ? 'warm' : 'mute'}>{m.cat}</Tag>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>{m.t}</span>
                  <Icons.arrow style={{ color: 'var(--mute)' }} />
                </div>
              </div>
              <div className="row gap-6" style={{ paddingLeft: 48 }}>
                <div className="col gap-1">
                  <span className="kicker">YOU SAID</span>
                  <span className="serif" style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>&ldquo;{m.user}&rdquo;</span>
                </div>
                <div className="col gap-1">
                  <span className="kicker eyebrow-warm">TARGET</span>
                  <span className="serif" style={{ fontStyle: 'italic' }}>&ldquo;{m.right}&rdquo;</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* What went well / concepts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <span className="eyebrow">What went well</span>
            <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
              {WENT_WELL.map((g, i) => (
                <li key={i} className="row gap-3" style={{ padding: '12px 0', borderTop: '1px solid var(--line)', alignItems: 'baseline' }}>
                  <Icons.check style={{ color: 'var(--leaf)' }} />
                  <span className="body">{g}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="eyebrow">Concepts covered · why they matter</span>
            <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
              {CONCEPTS.map(([t, d], i) => (
                <li key={i} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                  <div className="serif" style={{ fontSize: 17, marginBottom: 4 }}>{t}</div>
                  <p className="small" style={{ margin: 0 }}>{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <TutorStrip>
          <span className="kicker" style={{ fontStyle: 'normal', marginRight: 8 }}>RECOMMENDED NEXT ·</span>
          Fast-response drills with <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 13 }}>tenés / querés / podés</span>. ~12 min.
        </TutorStrip>

        <div className="row gap-3" style={{ marginTop: 32, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => router.push('/builder')}><Icons.spark /> Generate next lesson</button>
          <button className="btn btn-ghost" onClick={() => router.push('/mistakes')}>Practice mistakes</button>
          <button className="btn btn-ghost" onClick={() => router.push('/player')}><Icons.refresh /> Replay hard parts</button>
          <button className="btn btn-text" style={{ marginLeft: 'auto' }} onClick={() => router.push('/dashboard')}>Back to dashboard</button>
        </div>
      </div>
    </>
  );
}
