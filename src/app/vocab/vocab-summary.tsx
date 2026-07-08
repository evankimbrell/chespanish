'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { normalizeSpanish } from '@/lib/vocab-match';
import type { MistakeSummary } from '@/lib/common-mistakes';
import type { SessionResult } from './vocab-shared';

// Post-session summary: stats from the graded cards + a cross-feature nudge when a
// reviewed word also shows up in the learner's lesson mistakes.
export function VocabSummary({ userName, results, onHome, onAgain }: {
  userName: string;
  results: SessionResult[];
  onHome: () => void;
  onAgain: () => void;
}) {
  const router = useRouter();
  const [mistakeOverlap, setMistakeOverlap] = useState<string | null>(null);

  const reviewed = results.length;
  const correct = results.filter((r) => r.firstGrade !== 'again').length;
  const againWords = results.filter((r) => r.firstGrade === 'again').map((r) => r.note.es);
  const tomorrowEnd = new Date();
  tomorrowEnd.setHours(23, 59, 59, 999);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const dueSoon = results.filter((r) => new Date(r.newDue) <= tomorrowEnd).length;

  // Does any reviewed word also appear in the mistakes log?
  useEffect(() => {
    if (results.length === 0) return;
    fetch(`/api/mistakes?user=${encodeURIComponent(userName)}`)
      .then((r) => r.json())
      .then((d) => {
        const mistakes: MistakeSummary[] = d.mistakes ?? [];
        const haystack = mistakes.flatMap((m) => [
          m.name, m.target ?? '', m.commonWrong ?? '',
          ...m.examples.flatMap((e) => [e.youSaid, e.target ?? '']),
        ]).map(normalizeSpanish).join(' | ');
        const hit = results.find((r) => {
          const es = normalizeSpanish(r.note.es);
          return es.length > 2 && haystack.includes(es);
        });
        if (hit) setMistakeOverlap(hit.note.es);
      })
      .catch(() => {});
  }, [userName, results]);

  const blurb = reviewed === 0
    ? 'Session ended before any cards were graded.'
    : againWords.length === 0
      ? `${reviewed} card${reviewed === 1 ? '' : 's'} reviewed — nothing slipped.`
      : `${reviewed} card${reviewed === 1 ? '' : 's'} reviewed. ${againWords.length} slipped — ${againWords.length === 1 ? 'it' : 'they'}'ll come back sooner.`;

  return (
    <div className="page-narrow fade-in" style={{ maxWidth: 720, textAlign: 'center', paddingTop: 96 }}>
      <span className="eyebrow eyebrow-warm">Session complete</span>
      <h1 className="ty-h1" style={{ marginTop: 16, marginBottom: 16 }}>Buen laburo.</h1>
      <p className="lede" style={{ maxWidth: 480, margin: '0 auto 40px' }}>{blurb}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, border: '1px solid var(--line)', marginBottom: 40, textAlign: 'left' }}>
        {([
          ['Reviewed', String(reviewed), ''],
          ['Correct', String(correct), reviewed ? `${Math.round((correct / reviewed) * 100)}%` : ''],
          ['Again', String(againWords.length), againWords.slice(0, 2).join(', ')],
          ['Due soon', String(dueSoon), 'by tomorrow'],
        ] as [string, string, string][]).map(([k, v, s], i) => (
          <div key={k} style={{ padding: '20px 22px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
            <span className="eyebrow">{k}</span>
            <div className="serif tabular" style={{ fontSize: 36, marginTop: 6 }}>{v}</div>
            <span className="kicker" style={{ overflowWrap: 'anywhere' }}>{s}</span>
          </div>
        ))}
      </div>

      {mistakeOverlap && (
        <div className="card-flat" style={{ padding: '18px 24px', marginBottom: 40, textAlign: 'left' }}>
          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <span className="mate-icon" />
            <span className="small" style={{ color: 'var(--ink-2)' }}>
              <span className="serif" style={{ fontStyle: 'italic' }}>{mistakeOverlap}</span> also showed up in your
              lesson mistakes — want a quick focused drill?
            </span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => router.push('/builder')}>
              Build drill
            </button>
          </div>
        </div>
      )}

      <div className="row gap-3" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onHome}>Back to Vocab</button>
        <button className="btn btn-ghost" onClick={onAgain}><Icons.refresh /> Review again</button>
        <button className="btn btn-text" onClick={() => router.push('/dashboard')}>Dashboard</button>
      </div>
    </div>
  );
}
