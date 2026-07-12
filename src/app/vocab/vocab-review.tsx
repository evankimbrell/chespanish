'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/ui/icons';
import { Tag } from '@/components/ui/tag';
import { useTTS } from '@/hooks/use-tts';
import { useRecording } from '@/hooks/use-recording';
import { formatInterval, previewIntervals, requeueIndex } from '@/lib/srs';
import { matchesAnswer } from '@/lib/vocab-match';
import type { VocabCard, VocabGrade } from '@/lib/types';
import type { SessionCard, SessionResult } from './vocab-shared';

type Phase = 'loading' | 'empty' | 'front' | 'recording' | 'processing' | 'heard' | 'revealed';

const GRADE_ORDER: VocabGrade[] = ['again', 'hard', 'good', 'easy'];
const GRADE_LABEL: Record<VocabGrade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

// One SRS review session. Recognize cards reveal on space/click; recall cards are
// SPOKEN — mic → STT → advisory Match/Not-quite verdict — then graded like any card.
export function VocabReview({ userName, scope, onExit, onFinish }: {
  userName: string;
  scope: string;
  onExit: () => void;
  onFinish: (results: SessionResult[]) => void;
}) {
  const [queue, setQueue] = useState<SessionCard[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [gradedCount, setGradedCount] = useState(0);
  const [verdict, setVerdict] = useState<'match' | 'no_match' | null>(null);
  const [heard, setHeard] = useState<string | null>(null);

  const resultsRef = useRef<SessionResult[]>([]);
  const gradedNoteIdsRef = useRef<Set<string>>(new Set());
  const postChainRef = useRef<Promise<void>>(Promise.resolve());
  const shownAtRef = useRef<number>(Date.now());

  const { play: tts } = useTTS();
  const {
    startRecording, stopRecording, reset: resetRecording, primeMic,
    transcript, isTranscribing,
  } = useRecording();

  const current = queue[0] ?? null;
  const isRecall = current?.card.direction === 'recall';

  // Load the session queue
  useEffect(() => {
    let alive = true;
    fetch(`/api/vocab?user=${encodeURIComponent(userName)}&queue=${encodeURIComponent(scope)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const q: SessionCard[] = d.queue ?? [];
        setQueue(q);
        setPhase(q.length ? 'front' : 'empty');
        shownAtRef.current = Date.now();
      })
      .catch(() => alive && setPhase('empty'));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, scope]);

  // Recall flow: transcript arrives after stopRecording → advisory verdict
  useEffect(() => {
    if (phase !== 'processing' || isTranscribing || transcript === null || !current) return;
    setHeard(transcript);
    setVerdict(matchesAnswer(transcript, current.note.es) ? 'match' : 'no_match');
    setPhase('heard');
  }, [phase, isTranscribing, transcript, current]);

  const record = () => {
    if (phase === 'front') {
      resetRecording();
      startRecording({ language: 'es' });
      primeMic();
      setPhase('recording');
    } else if (phase === 'recording') {
      stopRecording();
      setPhase('processing');
    }
  };

  // "Not quite" → try saying it again: fresh recording + transcription, as many
  // times as it takes. The card stays revealed; grading is still the learner's call.
  const retryRecall = () => {
    setHeard(null);
    setVerdict(null);
    resetRecording();
    startRecording({ language: 'es' });
    primeMic();
    setPhase('recording');
  };

  const advance = useCallback((nextQueue: SessionCard[]) => {
    setQueue(nextQueue);
    setVerdict(null);
    setHeard(null);
    resetRecording();
    shownAtRef.current = Date.now();
    if (nextQueue.length === 0) onFinish(resultsRef.current);
    else setPhase('front');
  }, [onFinish, resetRecording]);

  const grade = useCallback((g: VocabGrade) => {
    if (!current) return;
    const { card, note, deckId } = current;
    const tookMs = Date.now() - shownAtRef.current;
    const gradeVerdict = verdict ?? undefined;
    const gradeHeard = heard ?? undefined;

    // First grade per card drives the summary stats
    if (!gradedNoteIdsRef.current.has(card.id)) {
      gradedNoteIdsRef.current.add(card.id);
      resultsRef.current.push({
        note, deckId, direction: card.direction, firstGrade: g,
        newDue: card.due, verdict: gradeVerdict,
      });
    }
    setGradedCount((n) => n + 1);

    // Serialize POSTs so the server's read-modify-write pairs can't interleave.
    const post = () =>
      fetch('/api/vocab/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, deckId, cardId: card.id, grade: g, heard: gradeHeard, verdict: gradeVerdict, tookMs }),
      })
        .then((r) => r.json())
        .then((d) => {
          const updated: VocabCard | undefined = d.card;
          if (!updated) return;
          const res = resultsRef.current.find((x) => x.note.id === note.id && x.direction === card.direction);
          if (res) res.newDue = updated.due;
          // Learning/relearning cards come back this session (learn-ahead: even if the
          // step timer hasn't elapsed by the time the queue empties, we show them).
          if (updated.state === 'learning' || updated.state === 'relearning') {
            setQueue((q) => {
              const idx = requeueIndex(q.map((s) => s.card), updated);
              const item: SessionCard = { ...current, card: updated };
              return [...q.slice(0, idx), item, ...q.slice(idx)];
            });
          }
        })
        .catch(() => {});
    postChainRef.current = postChainRef.current.then(post, post);

    advance(queue.slice(1));
  }, [current, queue, userName, verdict, heard, advance]);

  // Hotkeys: space reveals (recognize), 1–4 grade when the answer is visible
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space' && phase === 'front' && !isRecall) { e.preventDefault(); setPhase('revealed'); }
      if ((phase === 'revealed' || phase === 'heard') && ['1', '2', '3', '4'].includes(e.key)) {
        grade(GRADE_ORDER[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, isRecall, grade]);

  if (phase === 'loading') {
    return (
      <div className="page-narrow fade-in" style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  if (phase === 'empty' || !current) {
    return (
      <div className="page-narrow fade-in" style={{ maxWidth: 720, textAlign: 'center', paddingTop: 96 }}>
        <span className="eyebrow eyebrow-warm">Nothing due</span>
        <h1 className="ty-h1" style={{ marginTop: 16, marginBottom: 16 }}>All caught up.</h1>
        <p className="lede" style={{ maxWidth: 480, margin: '0 auto 40px' }}>No cards are due right now — come back later, or add another deck.</p>
        <button className="btn btn-primary" onClick={onExit}>Back to Vocab</button>
      </div>
    );
  }

  const { card, note } = current;
  const previews = previewIntervals(card, new Date());
  const total = gradedCount + queue.length;
  const answerVisible = phase === 'revealed' || phase === 'heard';

  return (
    <div className="page-narrow fade-in" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)', paddingTop: 32 }}>
      {/* Top bar */}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 12 }}>
        <button className="btn btn-text small" style={{ paddingLeft: 0 }} onClick={() => onFinish(resultsRef.current)}>
          <Icons.arrowLeft /> End session
        </button>
        <div className="row gap-4" style={{ alignItems: 'center' }}>
          <span className="kicker tabular">{gradedCount + 1} / {total}</span>
          <div className="row gap-2">
            <Tag kind={card.state === 'new' ? 'ink' : card.state === 'learning' || card.state === 'relearning' ? 'warm' : 'mute'}>{card.state}</Tag>
            <Tag kind="mute">{isRecall ? 'EN → ES · speak' : 'ES → EN'}</Tag>
          </div>
        </div>
      </div>
      <div className="progress" style={{ marginBottom: 36 }}>
        <div className="progress-fill" style={{ width: `${total ? (gradedCount / total) * 100 : 0}%` }} />
      </div>

      {/* Card */}
      <div className="card col" key={card.id} style={{ padding: 0, flex: 1, overflow: 'hidden' }}>
        {/* Header strip: tags + SRS stats */}
        <div className="row between" style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <div className="row gap-2">
            {note.tags.map((t) => (
              <span key={t} className="kicker" style={{ padding: '3px 8px', border: '1px solid var(--line)', borderRadius: 3 }}>{t}</span>
            ))}
          </div>
          <div className="row gap-4">
            {([['interval', card.intervalDays > 0 ? formatInterval(card.intervalDays * 1440) : '—'], ['ease', card.ease.toFixed(1)], ['reps', String(card.reps)], ['lapses', String(card.lapses)]] as [string, string][]).map(([k, v]) => (
              <span key={k} className="kicker tabular" style={{ color: 'var(--mute-2)' }}>{k} <span style={{ color: 'var(--mute)' }}>{v}</span></span>
            ))}
          </div>
        </div>

        <div className="col center" style={{ flex: 1, padding: '40px 48px', textAlign: 'center', gap: 0 }}>
          {isRecall ? (
            <>
              <span className="eyebrow eyebrow-warm">Say it in Spanish</span>
              <p className="serif" style={{ fontSize: 52, letterSpacing: '-.015em', margin: '18px 0 6px', fontWeight: 300 }}>{note.en}</p>
              {note.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={note.imageUrl} alt={note.en} style={{ width: 280, height: 170, objectFit: 'cover', borderRadius: 6, margin: '18px auto 0' }} />
              )}

              {phase === 'front' && (
                <div className="col gap-3" style={{ alignItems: 'center', marginTop: 32 }}>
                  <button className="mic-btn" style={{ width: 84, height: 84 }} onClick={record}><Icons.mic /></button>
                  <span className="mono small" style={{ color: 'var(--mute)' }}>Tap and say it out loud</span>
                  <button className="btn btn-text small" onClick={() => setPhase('revealed')}>I can&rsquo;t say it — show me</button>
                </div>
              )}
              {phase === 'recording' && (
                <div className="col gap-3" style={{ alignItems: 'center', marginTop: 32 }}>
                  <button className="mic-btn recording" style={{ width: 84, height: 84 }} onClick={record}><Icons.mic /></button>
                  <span className="mono small" style={{ color: 'var(--crit)' }}>● RECORDING · tap to stop</span>
                </div>
              )}
              {phase === 'processing' && (
                <div className="col gap-3" style={{ alignItems: 'center', marginTop: 32 }}>
                  <div className="spinner" style={{ width: 28, height: 28 }} />
                  <span className="mono small">Hearing you…</span>
                </div>
              )}
              {answerVisible && (
                <div className="col gap-2 fade-in" style={{ alignItems: 'center', marginTop: 28, width: '100%', maxWidth: 480 }}>
                  {phase === 'heard' && heard !== null && (
                    <div className="row gap-3" style={{ alignItems: 'center', padding: '12px 18px', border: '1px solid var(--line)', borderRadius: 4, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <span className="kicker">HEARD ·</span>
                      <span className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: verdict === 'match' ? 'var(--leaf)' : 'var(--crit)' }}>&ldquo;{heard || '…'}&rdquo;</span>
                      <Tag kind={verdict === 'match' ? 'leaf' : 'crit'}>{verdict === 'match' ? '● Match' : '● Not quite'}</Tag>
                      {verdict === 'no_match' && (
                        <button className="btn btn-ghost btn-sm" onClick={retryRecall}>
                          <Icons.refresh /> Try again
                        </button>
                      )}
                    </div>
                  )}
                  <hr className="divider" style={{ width: 64, margin: '16px auto' }} />
                  <span className="eyebrow">Answer</span>
                  {/* Play sits with the Spanish word it speaks — never with a tag/POS label. */}
                  <div className="row gap-3" style={{ alignItems: 'center', justifyContent: 'center', margin: '6px 0 2px' }}>
                    <button className="btn btn-icon btn-ghost" style={{ width: 34, height: 34 }} onClick={() => tts(note.es)}><Icons.play /></button>
                    <p className="serif" style={{ fontSize: 44, fontStyle: 'italic', margin: 0, color: 'var(--warm)' }}>{note.es}</p>
                  </div>
                  <ExampleRow note={note} tts={tts} />
                </div>
              )}
            </>
          ) : (
            <>
              <span className="eyebrow">What does this mean?</span>
              <p className="serif" style={{ fontSize: 56, fontStyle: 'italic', letterSpacing: '-.015em', margin: '18px 0 8px', fontWeight: 300, color: 'var(--ink)' }}>{note.es}</p>
              <div className="row gap-2" style={{ justifyContent: 'center', marginBottom: 6 }}>
                <button className="btn btn-icon btn-ghost" style={{ width: 34, height: 34 }} onClick={() => tts(note.es)}><Icons.play /></button>
              </div>
              {note.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={note.imageUrl} alt="" style={{ width: 280, height: 170, objectFit: 'cover', borderRadius: 6, margin: '14px auto 0' }} />
              )}
              {phase === 'front' ? (
                <button className="btn btn-ghost btn-lg" style={{ marginTop: 36 }} onClick={() => setPhase('revealed')}>
                  Show answer <span className="kicker" style={{ marginLeft: 4 }}>space</span>
                </button>
              ) : (
                <div className="col gap-2 fade-in" style={{ alignItems: 'center', marginTop: 24 }}>
                  <hr className="divider" style={{ width: 64, margin: '0 auto 16px' }} />
                  <span className="eyebrow">Answer</span>
                  <p className="serif" style={{ fontSize: 40, margin: '6px 0 2px', color: 'var(--warm)' }}>{note.en}</p>
                  <ExampleRow note={note} tts={tts} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Grade bar */}
        {answerVisible && (
          <div className="fade-in" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="row">
              {GRADE_ORDER.map((g, i) => (
                <button
                  key={g}
                  onClick={() => grade(g)}
                  style={{ flex: 1, padding: '16px 0 14px', background: 'transparent', border: 0, borderLeft: i ? '1px solid var(--line)' : 0, cursor: 'pointer', transition: 'background .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="col gap-1" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: g === 'again' ? 'var(--crit)' : g === 'easy' ? 'var(--leaf)' : 'var(--ink)' }}>{GRADE_LABEL[g]}</span>
                    <span className="kicker tabular">{previews[g]} · <span style={{ color: 'var(--mute-2)' }}>{i + 1}</span></span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Session footer */}
      <div className="row between" style={{ padding: '16px 4px' }}>
        <span className="kicker">{gradedCount} graded · {queue.length - 1 >= 0 ? queue.length - 1 : 0} remaining</span>
        <span className="kicker">space · reveal &nbsp; 1–4 · grade</span>
      </div>
    </div>
  );
}

function ExampleRow({ note, tts }: { note: SessionCard['note']; tts: (text: string) => void }) {
  if (!note.example) return null;
  return (
    <>
      <div className="row gap-3" style={{ marginTop: 10, alignItems: 'center', justifyContent: 'center' }}>
        <button className="btn btn-icon btn-ghost" style={{ width: 34, height: 34 }} onClick={() => tts(note.example!)}><Icons.play /></button>
        <span className="serif" style={{ fontSize: 17, fontStyle: 'italic', color: 'var(--ink-2)' }}>{note.example}</span>
      </div>
      {note.exampleEn && <span className="small" style={{ color: 'var(--mute-2)' }}>{note.exampleEn}</span>}
    </>
  );
}
