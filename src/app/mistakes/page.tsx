'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { COMMON_MISTAKES } from '@/lib/data';

const RECENT_GROUPS = [
  { day: 'Today', items: [
    'Used "quieres" instead of "querés" · in "Making plans"',
    'Forgot "me" in "me traés" · in "Making plans"',
    'Took 9.2 sec to respond to a future-tense prompt',
  ]},
  { day: 'Yesterday', items: [
    'Misheard "dale" as "vale"',
    'Slow response to "¿De dónde sos?"',
  ]},
  { day: 'May 7', items: [
    '"Deseo un café" instead of "Quiero un café"',
    'Confused "por" and "para" twice',
  ]},
];

const CATEGORIES = [
  ['Conjugation', 14, 'Mostly vos forms'],
  ['Speed', 11, 'Direct questions hesitation'],
  ['Grammar', 8, 'Object pronouns'],
  ['Tense', 6, 'Pretérito vs imperfecto'],
  ['Listening', 5, 'Fast casual phrases'],
  ['Naturalness', 3, 'Overformal word choices'],
  ['Pronunciation', 2, 'STT had trouble'],
  ['Vocabulary', 1, 'Scenario-specific gaps'],
  ['Flow', 1, 'Socially abrupt answer'],
];

type Tab = 'common' | 'recent' | 'categories';

export default function MistakesPage() {
  const [tab, setTab] = useState<Tab>('common');
  const router = useRouter();

  return (
    <>
      <TopNav />
      <div className="page fade-in">
        <SectionHead num="01 / Diagnostic" title="What's tripping you up." sub="Patterns we've seen across 12 lessons. Practice anything here, or push it into the next lesson." />

        <div className="row gap-2" style={{ marginBottom: 32, borderBottom: '1px solid var(--line)' }}>
          {([['common', 'Most common (12)'], ['recent', 'Recent (this week)'], ['categories', 'By category']] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                background: 'transparent', border: 0, padding: '12px 16px', cursor: 'pointer',
                color: tab === id ? 'var(--ink)' : 'var(--mute)',
                borderBottom: tab === id ? '1px solid var(--ink)' : '1px solid transparent',
                marginBottom: -1,
                fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'common' && (
          <div className="col" style={{ border: '1px solid var(--line)' }}>
            {COMMON_MISTAKES.map((m, i) => (
              <div
                key={m.id}
                style={{ padding: '24px 28px', borderTop: i ? '1px solid var(--line)' : 'none' }}
                className="card-hover"
                onClick={() => router.push(`/mistakes/${m.id}`)}
              >
                <div className="row between" style={{ alignItems: 'baseline' }}>
                  <div className="row gap-4" style={{ alignItems: 'baseline', flex: 1 }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)', width: 24 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div className="col gap-2" style={{ flex: 1 }}>
                      <div className="row gap-3" style={{ alignItems: 'baseline' }}>
                        <span className="serif" style={{ fontSize: 24, letterSpacing: '-.005em' }}>{m.name}</span>
                        <Tag kind={m.severity === 'high' ? 'crit' : m.severity === 'med' ? 'warm' : 'mute'}>{m.severity}</Tag>
                        <Tag kind="mute">{m.cat}</Tag>
                      </div>
                      <div className="row gap-6">
                        <span className="kicker">Missed <span className="tabular" style={{ color: 'var(--ink-2)' }}>{m.count}×</span></span>
                        <span className="kicker">Last · {m.last}</span>
                        {m.wrong && <span className="kicker">Common wrong · <span style={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', color: 'var(--mute)' }}>{m.wrong}</span></span>}
                        {m.right && <span className="kicker">Target · <span style={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', color: 'var(--warm)' }}>{m.right}</span></span>}
                      </div>
                    </div>
                  </div>
                  <div className="row gap-2" style={{ alignSelf: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); router.push('/builder'); }}>Practice</button>
                    <button className="btn btn-text small" onClick={(e) => { e.stopPropagation(); router.push(`/mistakes/${m.id}`); }}>Explain <Icons.arrow /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'recent' && (
          <div className="col gap-6">
            {RECENT_GROUPS.map(({ day, items }) => (
              <div key={day}>
                <span className="eyebrow">{day}</span>
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                  {items.map((t, i) => (
                    <li key={i} className="row gap-3" style={{ padding: '12px 0', borderTop: '1px solid var(--line)', alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--crit)', fontSize: 9, marginTop: 6 }}>●</span>
                      <span className="body" style={{ flex: 1 }}>{t}</span>
                      <button className="btn btn-text small" style={{ padding: '0 4px' }} onClick={() => router.push('/mistakes/m1')}>Explain</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {tab === 'categories' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
            {CATEGORIES.map(([n, c, s], i) => (
              <div key={String(n)} className="card-hover" style={{ background: 'var(--bg)', padding: 24, cursor: 'pointer' }}>
                <div className="row between" style={{ marginBottom: 12 }}>
                  <span className="eyebrow">{n}</span>
                  <span className="serif" style={{ fontSize: 20 }}>{c}</span>
                </div>
                <p className="small" style={{ margin: 0 }}>{s}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
