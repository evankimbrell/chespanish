'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { TutorStrip } from '@/components/ui/tutor-strip';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';
import type { LessonResults } from '@/lib/lesson-results';

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  return `${m} min`;
}

function fmtClock(sec: number | null): string {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ReportPage() {
  const router = useRouter();
  const userName = useAppStore((s) => s.profile.name);
  const lesson = useAppStore((s) => s.generatedLesson);
  const [results, setResults] = useState<LessonResults | null>(null);
  const [loading, setLoading] = useState(true);

  const lessonId = lesson?.generatedAt;

  useEffect(() => {
    if (!userName || !lessonId) { setLoading(false); return; }
    const params = new URLSearchParams({ user: userName, lessonId, title: lesson?.title ?? '' });
    fetch(`/api/lesson/results?${params}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userName, lessonId, lesson?.title]);

  if (loading) {
    return (
      <>
        <TopNav />
        <div className="page-narrow fade-in"><p className="lede" style={{ marginTop: 60 }}>Loading your results…</p></div>
      </>
    );
  }

  if (!results || (results.responseCount === 0 && results.mistakes.length === 0)) {
    return (
      <>
        <TopNav />
        <div className="page-narrow fade-in">
          <span className="eyebrow eyebrow-warm">Lesson complete</span>
          <h1 className="ty-h1" style={{ marginTop: 14, marginBottom: 18 }}>{results?.lessonTitle ?? lesson?.title ?? 'Your lesson'}.</h1>
          <p className="lede" style={{ maxWidth: 560 }}>
            We don&rsquo;t have any recorded responses for this lesson yet, so there&rsquo;s nothing to summarize.
            Complete a lesson with spoken responses to see your results here.
          </p>
          <div className="row gap-3" style={{ marginTop: 32 }}>
            <button className="btn btn-primary" onClick={() => router.push('/builder')}><Icons.spark /> Generate next lesson</button>
            <button className="btn btn-text" style={{ marginLeft: 'auto' }} onClick={() => router.push('/dashboard')}>Back to dashboard</button>
          </div>
        </div>
      </>
    );
  }

  const { lessonTitle, durationSec, score, avgRecallSec, mistakeCounts, mistakes, wentWell, conceptsCovered } = results;

  const stats: [string, string, string][] = [
    ['Score', score != null ? String(score) : '—', 'of 100'],
    ['Time', fmtDuration(durationSec), 'to finish'],
    ['Avg recall', avgRecallSec != null ? `${avgRecallSec}s` : '—', 'time to start speaking'],
    ['Mistakes', String(mistakeCounts.total), `${mistakeCounts.new} new · ${mistakeCounts.recurring} recurring`],
  ];

  // Basic "recommended next" — the most frequent mistake category this lesson.
  const catCounts = new Map<string, number>();
  for (const m of mistakes) catCounts.set(m.category, (catCounts.get(m.category) ?? 0) + 1);
  const topCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <>
      <TopNav />
      <div className="page-narrow fade-in">
        <span className="eyebrow eyebrow-warm">Lesson complete{results.completed ? ' · 100%' : ''}</span>
        <h1 className="ty-h1" style={{ marginTop: 14, marginBottom: 18 }}>{lessonTitle}.</h1>
        <p className="lede" style={{ maxWidth: 560 }}>
          {durationSec != null ? `You finished in ${fmtDuration(durationSec)}. ` : ''}
          {mistakeCounts.total === 0
            ? 'Clean run — no notable slips this time.'
            : `${mistakeCounts.total} thing${mistakeCounts.total === 1 ? '' : 's'} to tighten up, listed below.`}
        </p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, border: '1px solid var(--line)', marginTop: 40, marginBottom: 48 }}>
          {stats.map(([k, v, s], i) => (
            <div key={k} style={{ padding: '24px 24px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
              <span className="eyebrow">{k}</span>
              <div className="serif" style={{ fontSize: 42, marginTop: 8, letterSpacing: '-.015em' }}>{v}</div>
              <span className="kicker">{s}</span>
            </div>
          ))}
        </div>

        {/* Mistakes */}
        {mistakes.length > 0 && (
          <>
            <SectionHead num="01 / Misses" title="Where you slipped." sub="Pulled from your graded responses this lesson." />
            <div className="col" style={{ border: '1px solid var(--line)', marginBottom: 48 }}>
              {mistakes.map((m, i) => (
                <div key={i} style={{ padding: '20px 24px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <div className="row between" style={{ alignItems: 'baseline', marginBottom: 8 }}>
                    <div className="row gap-3" style={{ alignItems: 'baseline' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)', width: 36 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="serif" style={{ fontSize: 19 }}>{m.description || m.category}</span>
                    </div>
                    <div className="row gap-2" style={{ alignItems: 'center' }}>
                      <Tag kind={m.severity === 'high' ? 'crit' : m.severity === 'med' ? 'warm' : 'mute'}>{m.category}</Tag>
                      {m.atOffsetSec != null && <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>{fmtClock(m.atOffsetSec)}</span>}
                    </div>
                  </div>
                  <div className="row gap-6" style={{ paddingLeft: 48 }}>
                    <div className="col gap-1">
                      <span className="kicker">YOU SAID</span>
                      <span className="serif" style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>&ldquo;{m.youSaid}&rdquo;</span>
                    </div>
                    {m.target && (
                      <div className="col gap-1">
                        <span className="kicker eyebrow-warm">TARGET</span>
                        <span className="serif" style={{ fontStyle: 'italic' }}>&ldquo;{m.target}&rdquo;</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* What went well / concepts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <span className="eyebrow">What went well</span>
            <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
              {(wentWell.length ? wentWell : ['You completed the lesson — keep going.']).map((g, i) => (
                <li key={i} className="row gap-3" style={{ padding: '12px 0', borderTop: '1px solid var(--line)', alignItems: 'baseline' }}>
                  <Icons.check style={{ color: 'var(--leaf)' }} />
                  <span className="body">{g}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="eyebrow">Concepts covered</span>
            <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
              {(conceptsCovered.length ? conceptsCovered : ['—']).map((t, i) => (
                <li key={i} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                  <div className="serif" style={{ fontSize: 17 }}>{t}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {topCategory && (
          <TutorStrip>
            <span className="kicker" style={{ fontStyle: 'normal', marginRight: 8 }}>RECOMMENDED NEXT ·</span>
            More practice on <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 13 }}>{topCategory}</span>.
          </TutorStrip>
        )}

        <div className="row gap-3" style={{ marginTop: 32, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => router.push('/builder')}><Icons.spark /> Generate next lesson</button>
          <button className="btn btn-ghost" onClick={() => router.push('/mistakes')}>Practice mistakes</button>
          <button className="btn btn-text" style={{ marginLeft: 'auto' }} onClick={() => router.push('/dashboard')}>Back to dashboard</button>
        </div>
      </div>
    </>
  );
}
