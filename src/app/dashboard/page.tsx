'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { DashboardCustomPrompt } from '@/components/builder/dashboard-custom-prompt';
import { SCENARIOS } from '@/lib/data';
import { useAppStore } from '@/lib/store';

export default function DashboardPage() {
  const router = useRouter();
  const { name, level, lessonsCompleted, streak, totalSpeaking } = useAppStore((s) => s.profile);
  const generatedLesson = useAppStore((s) => s.generatedLesson);
  const setGeneratedLesson = useAppStore((s) => s.setGeneratedLesson);
  const [preparing, setPreparing] = useState(false);
  const preparedRef = useRef(false);
  const [recentLessons, setRecentLessons] = useState<{ id: string; title: string; date: string; duration: number; completed: boolean; completionPct?: number }[]>([]);

  // Auto-prepare a lesson if none exists yet for this user
  useEffect(() => {
    if (generatedLesson || preparedRef.current) return;
    preparedRef.current = true;
    setPreparing(true);
    fetch(`/api/lesson/prepare?user=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.transcript) {
          setGeneratedLesson({
            transcript: data.transcript,
            plays: [],
            generatedAt: new Date().toISOString(),
            title: data.title ?? 'Your first lesson',
          });
        }
      })
      .catch(() => {})
      .finally(() => setPreparing(false));
  }, [name]);

  // Fetch recent lesson history for this user
  useEffect(() => {
    fetch(`/api/lesson/history?user=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => {
        const entries = d.entries ?? [];
        setRecentLessons(entries.slice(0, 3).map((e: { id: string; title: string; lastAccessedAt: string; totalCount: number; playIdx: number; completed: boolean }) => ({
          id: e.id,
          title: e.title,
          date: new Date(e.lastAccessedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          duration: Math.max(1, Math.round(e.totalCount * 13 / 60)),
          completed: e.completed,
          completionPct: e.completed ? undefined : Math.round(Math.min(99, (e.playIdx / Math.max(1, e.totalCount)) * 100)),
        })));
      })
      .catch(() => {});
  }, [name]);

  const STATS = [
    { k: 'Level',    v: level,              s: 'from level test' },
    { k: 'Lessons',  v: String(lessonsCompleted), s: '6 this week' },
    { k: 'Streak',   v: `${streak} days`,   s: 'best: 11' },
    { k: 'Speaking', v: totalSpeaking,      s: 'avg 22 min' },
  ];

  return (
    <>
      <TopNav />
      <div className="page fade-in">
        <div className="col gap-12">
          {/* Hero strip */}
          <div style={{ paddingBottom: 32, borderBottom: '1px solid var(--line)' }}>
            <div className="row gap-8" style={{ justifyContent: 'flex-end', marginBottom: 32 }}>
              {STATS.map((s) => (
                <div key={s.k} className="col gap-1" style={{ minWidth: 90, textAlign: 'right' }}>
                  <span className="eyebrow">{s.k}</span>
                  <span className="serif" style={{ fontSize: 28, letterSpacing: '-.01em' }}>{s.v}</span>
                  <span className="small" style={{ color: 'var(--mute-2)' }}>{s.s}</span>
                </div>
              ))}
            </div>
            <span className="eyebrow">Buenos días, {name} · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <h1 className="ty-h1" style={{ marginTop: 8 }}>
              Pick up where you left off, or{' '}
              <em style={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', color: 'var(--warm)' }}>
                build something new
              </em>.
            </h1>
          </div>

          {/* Recommended + in-progress */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
            <div className="card" style={{ padding: 36, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -40, top: -40, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(212,165,116,.12),transparent 70%)' }} />
              <span className="eyebrow eyebrow-warm">
                Recommended next · for you
                {preparing && <span className="mono" style={{ marginLeft: 10, fontSize: 10, color: 'var(--mute-2)', letterSpacing: '.06em' }}>Preparing…</span>}
              </span>
              <h2 className="ty-h2" style={{ marginTop: 14, marginBottom: 16, maxWidth: 480 }}>
                {generatedLesson?.title ?? (preparing ? '…' : 'Practice making plans and responding faster.')}
              </h2>
              <p className="body" style={{ maxWidth: 560 }}>
                {generatedLesson
                  ? generatedLesson.transcript.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160) + '…'
                  : preparing
                    ? <span style={{ color: 'var(--mute-2)' }}>Building your personalized lesson based on your level test…</span>
                    : <>You&rsquo;re accurate with simple café and restaurant phrases, but you hesitate on open-ended responses and still slip into{' '}
                      <span style={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic' }}>tú</span> forms.
                      This lesson drills <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 13 }}>querés / tenés / podés</span> with timed responses.</>
                }
              </p>
              <div className="row gap-2" style={{ marginTop: 24, flexWrap: 'wrap' }}>
                <Tag kind="warm">25 min</Tag>
                <Tag kind="mute">{generatedLesson ? 'Personalized' : preparing ? 'Generating…' : 'Personalized'}</Tag>
              </div>
              <div className="row gap-3" style={{ marginTop: 32 }}>
                <button
                  className="btn btn-primary"
                  disabled={preparing && !generatedLesson}
                  onClick={() => router.push(generatedLesson ? '/lesson' : '/preview')}
                >
                  Start lesson <Icons.arrow />
                </button>
                <button className="btn btn-ghost" onClick={() => router.push('/builder')}>Customize first</button>
              </div>
            </div>

            <div className="col gap-3">
              <div className="card-flat" style={{ padding: 20 }}>
                <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
                  <span className="eyebrow">In progress</span>
                  <span className="mono small">62%</span>
                </div>
                <div className="serif" style={{ fontSize: 20, marginBottom: 4 }}>Apartment hot water issue</div>
                <p className="small" style={{ marginBottom: 12 }}>Paused at the listening dialogue · 11 min left</p>
                <div className="progress" style={{ marginBottom: 14 }}>
                  <div className="progress-fill" style={{ width: '62%' }} />
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => router.push('/player')}>
                  <Icons.play /> Resume
                </button>
              </div>

              <div className="card-flat" style={{ padding: 20 }}>
                <span className="eyebrow">Why this recommendation</span>
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                  {[['7×', 'missed "querés" this week'], ['9×', 'slow on direct questions'], ['3×', 'asked to practice social plans']].map(([n, t]) => (
                    <li key={t} className="row gap-3" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                      <span className="mono" style={{ color: 'var(--warm)', width: 32, fontSize: 13 }}>{n}</span>
                      <span className="small" style={{ color: 'var(--ink-2)' }}>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Quick generate */}
          <div>
            <SectionHead
              num="01 / Generate"
              title="What do you want to practice today?"
              sub="Type a situation in your own words, or pick a scenario below. The full builder gives you finer control."
              right={
                <button className="btn btn-text small" onClick={() => router.push('/builder')}>
                  Open lesson builder <Icons.arrow />
                </button>
              }
            />
            <DashboardCustomPrompt />

            <div className="row between" style={{ alignItems: 'baseline', margin: '28px 0 14px' }}>
              <span className="eyebrow">Or pick a scenario</span>
              <span className="kicker">8 of {SCENARIOS.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {SCENARIOS.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  className="card-hover"
                  onClick={() => router.push('/builder')}
                  style={{ textAlign: 'left', background: 'var(--bg-2)', border: '1px solid var(--line)', padding: '18px 18px 16px', borderRadius: 4, cursor: 'pointer' }}
                >
                  <div className="serif" style={{ fontSize: 20, marginBottom: 6 }}>{s.label}</div>
                  <div className="kicker" style={{ fontStyle: 'italic', color: 'var(--mute)' }}>{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent lessons */}
          {recentLessons.length > 0 && (
            <div>
              <SectionHead
                num="02 / Library"
                title="Recent lessons"
                right={
                  <button className="btn btn-text small" onClick={() => router.push('/lessons')}>
                    See all <Icons.arrow />
                  </button>
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
                {recentLessons.map((l) => (
                  <div
                    key={l.id}
                    className="card-hover"
                    style={{ background: 'var(--bg)', padding: 24, cursor: 'pointer' }}
                    onClick={() => router.push('/lessons')}
                  >
                    <div className="row between" style={{ marginBottom: 14, alignItems: 'center' }}>
                      <span className="kicker">{l.date} · {l.duration} min</span>
                      {l.completed
                        ? <span style={{ color: 'var(--leaf)', fontSize: 14 }}>✓</span>
                        : <span className="mono small" style={{ color: 'var(--mute-2)' }}>{l.completionPct}%</span>
                      }
                    </div>
                    <div className="serif" style={{ fontSize: 22, letterSpacing: '-.01em', marginBottom: 8 }}>{l.title}</div>
                    <div className="small" style={{ color: 'var(--mute)' }}>{l.completed ? 'Completed' : 'In progress'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
