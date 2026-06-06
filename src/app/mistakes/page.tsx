'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';
import type { MistakeSummary } from '@/lib/common-mistakes';

type Tab = 'common' | 'recent' | 'categories';

function relativeDay(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function withinDays(iso: string | null, n: number): boolean {
  if (!iso) return false;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000 <= n;
}

export default function MistakesPage() {
  const [tab, setTab] = useState<Tab>('common');
  const router = useRouter();
  const userName = useAppStore((s) => s.profile.name);
  const level = useAppStore((s) => s.profile.level);
  const setGeneratedLesson = useAppStore((s) => s.setGeneratedLesson);

  const [mistakes, setMistakes] = useState<MistakeSummary[]>([]);
  const [lessonsCount, setLessonsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [practicingId, setPracticingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userName) { setLoading(false); return; }
    fetch(`/api/mistakes?user=${encodeURIComponent(userName)}`)
      .then((r) => r.json())
      .then((d) => { setMistakes(Array.isArray(d.mistakes) ? d.mistakes : []); setLessonsCount(d.lessonsCount ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userName]);

  const practice = async (m: MistakeSummary) => {
    if (practicingId) return;
    setPracticingId(m.id);
    try {
      const res = await fetch('/api/mistakes/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, mistakeId: m.id, level }),
      });
      const data = await res.json();
      if (!data.transcript) { setPracticingId(null); return; }
      setGeneratedLesson({
        transcript: data.transcript,
        title: data.title ?? `Targeted practice · ${m.name}`,
        generatedAt: new Date().toISOString(),
        plays: [],
      });
      router.push('/lesson'); // generates audio, then routes to /player
    } catch {
      setPracticingId(null);
    }
  };

  const common = [...mistakes].sort((a, b) => b.count - a.count);
  const recent = common.filter((m) => withinDays(m.lastSeenAt, 7))
    .sort((a, b) => new Date(b.lastSeenAt ?? 0).getTime() - new Date(a.lastSeenAt ?? 0).getTime());
  const byCategory = Object.values(
    mistakes.reduce<Record<string, { category: string; count: number; names: string[] }>>((acc, m) => {
      const k = m.category;
      acc[k] ??= { category: k, count: 0, names: [] };
      acc[k].count += m.count;
      if (acc[k].names.length < 2) acc[k].names.push(m.name);
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  const renderRows = (list: MistakeSummary[]) => (
    <div className="col" style={{ border: '1px solid var(--line)' }}>
      {list.map((m, i) => (
        <div key={m.id} style={{ padding: '24px 28px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div className="row gap-4" style={{ alignItems: 'baseline', flex: 1 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)', width: 24 }}>{String(i + 1).padStart(2, '0')}</span>
              <div className="col gap-2" style={{ flex: 1 }}>
                <div className="row gap-3" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span className="serif" style={{ fontSize: 24, letterSpacing: '-.005em' }}>{m.name}</span>
                  <Tag kind={m.severity === 'high' ? 'crit' : m.severity === 'med' ? 'warm' : 'mute'}>{m.severity}</Tag>
                  <Tag kind="mute">{m.category}</Tag>
                </div>
                <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
                  <span className="kicker">Missed <span className="tabular" style={{ color: 'var(--ink-2)' }}>{m.count}×</span></span>
                  <span className="kicker">Last · {relativeDay(m.lastSeenAt)}</span>
                  {m.commonWrong && <span className="kicker">Common wrong · <span style={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', color: 'var(--mute)' }}>{m.commonWrong}</span></span>}
                  {m.target && <span className="kicker">Target · <span style={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', color: 'var(--warm)' }}>{m.target}</span></span>}
                </div>
              </div>
            </div>
            <div className="row gap-2" style={{ alignSelf: 'center' }}>
              <button className="btn btn-ghost btn-sm" disabled={practicingId !== null} onClick={() => practice(m)}>
                {practicingId === m.id ? 'Generating…' : 'Practice'}
              </button>
              <button className="btn btn-text small" disabled title="Coming soon" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                Explain <Icons.arrow />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <TopNav />
      <div className="page fade-in">
        <SectionHead
          num="01 / Diagnostic"
          title="What's tripping you up."
          sub={`Patterns we've seen${lessonsCount ? ` across ${lessonsCount} lesson${lessonsCount === 1 ? '' : 's'}` : ''}. Practice anything here to drill just that.`}
        />

        <div className="row gap-2" style={{ marginBottom: 32, borderBottom: '1px solid var(--line)' }}>
          {([['common', `Most common (${common.length})`], ['recent', 'Recent (this week)'], ['categories', 'By category']] as [Tab, string][]).map(([id, label]) => (
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

        {loading ? (
          <p className="lede" style={{ color: 'var(--mute)' }}>Loading your mistakes…</p>
        ) : mistakes.length === 0 ? (
          <p className="lede" style={{ maxWidth: 560, color: 'var(--mute)' }}>
            No mistakes logged yet. Complete a lesson with spoken responses and your recurring patterns will show up here.
          </p>
        ) : (
          <>
            {tab === 'common' && renderRows(common)}
            {tab === 'recent' && (recent.length ? renderRows(recent) : <p className="lede" style={{ color: 'var(--mute)' }}>Nothing in the last 7 days.</p>)}
            {tab === 'categories' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
                {byCategory.map((c) => (
                  <div key={c.category} style={{ background: 'var(--bg)', padding: 24 }}>
                    <div className="row between" style={{ marginBottom: 12 }}>
                      <span className="eyebrow">{c.category}</span>
                      <span className="serif" style={{ fontSize: 20 }}>{c.count}</span>
                    </div>
                    <p className="small" style={{ margin: 0 }}>{c.names.join(' · ')}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
