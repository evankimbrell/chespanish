'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

// Lesson audio generation happens here — redirect to /player which has the designed UI.
// If plays haven't been generated yet, call /api/lesson/audio first then navigate.
export default function LessonPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const generatedLesson = useAppStore((s) => s.generatedLesson);
  const setGeneratedLesson = useAppStore((s) => s.setGeneratedLesson);

  useEffect(() => {
    if (!generatedLesson?.transcript) {
      router.replace('/dashboard');
      return;
    }

    // Audio already generated — go straight to player
    if (generatedLesson.plays?.length > 0) {
      router.replace('/player');
      return;
    }

    // Need to generate audio first
    fetch('/api/lesson/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: generatedLesson.transcript, userName: profile.name }),
    })
      .then((r) => r.json())
      .then((data) => {
        setGeneratedLesson({ ...generatedLesson, plays: data.plays ?? [] });
        router.replace('/player');
      })
      .catch(() => router.replace('/player'));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <p className="serif" style={{ fontSize: 22 }}>Preparing your lesson…</p>
      <p className="small" style={{ color: 'var(--mute)' }}>Generating personalized audio — about 30–60 seconds.</p>
    </div>
  );
}
