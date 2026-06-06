'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

// Lesson audio generation happens here — then we redirect to /player. If plays haven't
// been generated yet, call /api/lesson/audio first. On a transient failure we show an
// inline retry rather than bouncing to the dashboard (which caused a confusing flash).
export default function LessonPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const generatedLesson = useAppStore((s) => s.generatedLesson);
  const setGeneratedLesson = useAppStore((s) => s.setGeneratedLesson);
  const startedRef = useRef(false);
  const [error, setError] = useState(false);

  const generate = async () => {
    const lesson = useAppStore.getState().generatedLesson;
    if (!lesson?.transcript) { router.replace('/dashboard'); return; }
    if (lesson.plays?.length > 0) { router.replace('/player'); return; }

    setError(false);
    try {
      const res = await fetch('/api/lesson/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: lesson.transcript, userName: profile.name, startIdx: 0, count: 12 }),
      });
      const data = await res.json();
      const plays = data.plays ?? [];
      if (plays.length === 0) throw new Error('no plays generated');
      setGeneratedLesson({
        ...lesson,
        plays,
        totalCount: data.totalCount ?? plays.length,
        allPlayMeta: data.allPlayMeta,
      });
      router.replace('/player');
    } catch (e) {
      console.error('[lesson] audio generation failed:', e);
      setError(true);
    }
  };

  useEffect(() => {
    if (startedRef.current) return; // guard against double-invocation (StrictMode / re-render)
    startedRef.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <p className="serif" style={{ fontSize: 22 }}>We couldn&rsquo;t generate the audio.</p>
        <p className="small" style={{ color: 'var(--mute)', maxWidth: 420 }}>Something went wrong preparing this lesson. You can try again.</p>
        <div className="row gap-3">
          <button className="btn btn-primary" onClick={() => { setError(false); generate(); }}>Try again</button>
          <button className="btn btn-ghost" onClick={() => router.replace('/dashboard')}>Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <p className="serif" style={{ fontSize: 22 }}>Preparing your lesson…</p>
      <p className="small" style={{ color: 'var(--mute)' }}>Generating personalized audio — about 30–60 seconds.</p>
    </div>
  );
}
