'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/ui/icons';
import { Tag } from '@/components/ui/tag';
import { useAppStore } from '@/lib/store';
import { splitForReview, replayAnswer, type GradedResponse } from '@/lib/lesson-review';
import type { LessonGrade } from '@/lib/types';

// End-of-lesson review. The player never interrupts the cruise for a grade, so this
// screen is where every response gets its moment: clear misses first with full
// feedback, everything else in a compact list below. Grades still in flight when the
// lesson ends fill in live as they resolve.

const LABEL_KIND: Record<LessonGrade['label'], 'leaf' | 'warm' | 'crit' | 'mute'> = {
  Excellent: 'leaf',
  Good: 'leaf',
  Ok: 'mute',
  Almost: 'warm',
  Ouch: 'crit',
};

const truncate = (s: string, n = 150) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export function SessionReview({ results, onSeeReport }: {
  results: GradedResponse[];
  onSeeReport: () => void;
}) {
  const spanishSpeed = useAppStore((s) => s.spanishSpeed);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  // Same playback path as mid-lesson "Hear correct version": server TTS at the
  // learner's chosen Spanish speed.
  const speak = useCallback((r: GradedResponse) => {
    const text = replayAnswer(r);
    if (!text) return;
    audioRef.current?.pause();
    setSpeakingId(r.id);
    fetch('/api/lesson/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speed: spanishSpeed }),
    })
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
        const audio = new Audio(url);
        audioRef.current = audio;
        const done = () => { URL.revokeObjectURL(url); setSpeakingId((id) => (id === r.id ? null : id)); };
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
      })
      .catch(() => setSpeakingId((id) => (id === r.id ? null : id)));
  }, [spanishSpeed]);

  const { review, rest } = splitForReview(results);
  const graded = results.filter((r) => r.grade).length;
  const pending = results.length - graded - results.filter((r) => r.gradeFailed).length;

  const GradeChip = ({ r }: { r: GradedResponse }) => r.grade
    ? (
      <>
        <Tag kind={LABEL_KIND[r.grade.label]}>{r.grade.label}</Tag>
        {/* Neutral dialect note — never an error: Scribe often renders spoken voseo
            as standard forms, so tú-vs-vos is marked but not graded. */}
        {r.grade.used_standard_spanish && <Tag kind="mute">standard es</Tag>}
      </>
    )
    : r.gradeFailed
      ? <Tag kind="mute">Not graded</Tag>
      : <Tag kind="mute">Grading…</Tag>;

  const HearButton = ({ r }: { r: GradedResponse }) => {
    if (!replayAnswer(r)) return null;
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => speak(r)} disabled={speakingId === r.id}>
        <Icons.play /> {speakingId === r.id ? 'Playing…' : 'Hear it'}
      </button>
    );
  };

  return (
    <div className="col gap-4 fade-in" style={{ alignItems: 'center', marginTop: 24, width: '100%', maxWidth: 760, paddingBottom: 40 }}>
      <h2 className="ty-h1">Buen laburo.</h2>
      <p className="small" style={{ color: 'var(--mute)', margin: 0, textAlign: 'center' }}>
        {results.length === 0
          ? 'No spoken prompts this session.'
          : review.length === 0 && pending === 0
            ? `All ${results.length} responses came through clean.`
            : `${results.length} responses · ${review.length} worth another look${pending > 0 ? ` · ${pending} still grading` : ''}`}
      </p>
      <button className="btn btn-primary btn-lg" onClick={onSeeReport}>
        See your report <Icons.arrow />
      </button>

      {review.length > 0 && (
        <div className="col gap-3" style={{ width: '100%', marginTop: 16 }}>
          <span className="eyebrow eyebrow-warm">Worth another look</span>
          {review.map((r) => (
            <div key={r.id} className="card" style={{ padding: 20 }}>
              <p className="small" style={{ color: 'var(--mute)', margin: '0 0 8px' }}>{truncate(r.promptText)}</p>
              <div className="row gap-2" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                <GradeChip r={r} />
                <span className="serif" style={{ fontSize: 20, fontStyle: 'italic' }}>&ldquo;{r.transcript}&rdquo;</span>
              </div>
              {r.grade?.brief_feedback && (
                <p className="small" style={{ color: 'var(--ink-2)', margin: '10px 0 0' }}>{r.grade.brief_feedback}</p>
              )}
              {(r.grade?.observed_errors?.length ?? 0) > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {r.grade!.observed_errors.map((err, i) => (
                    <li key={i} className="small" style={{ color: 'var(--mute)', marginBottom: 2 }}>
                      <strong>{err.category}</strong>: {err.description}
                    </li>
                  ))}
                </ul>
              )}
              {replayAnswer(r) && (
                <div className="row gap-3" style={{ alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
                  <span className="serif" style={{ fontSize: 18, fontStyle: 'italic', color: 'var(--warm)' }}>
                    &ldquo;{replayAnswer(r)}&rdquo;
                  </span>
                  <HearButton r={r} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="col gap-2" style={{ width: '100%', marginTop: review.length > 0 ? 20 : 16 }}>
          <span className="eyebrow">The rest</span>
          {rest.map((r) => (
            <div key={r.id} className="row gap-3" style={{ alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <GradeChip r={r} />
              <span className="serif" style={{ fontSize: 17, fontStyle: 'italic', flex: 1, minWidth: 200 }}>&ldquo;{r.transcript}&rdquo;</span>
              <HearButton r={r} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
