'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Wave } from '@/components/ui/wave';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';
import type { LessonPlay } from '@/lib/types';

export default function LessonPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const generatedLesson = useAppStore((s) => s.generatedLesson);
  const setGeneratedLesson = useAppStore((s) => s.setGeneratedLesson);

  const [plays, setPlays] = useState<LessonPlay[]>(generatedLesson?.plays ?? []);
  const [loading, setLoading] = useState((generatedLesson?.plays ?? []).length === 0);
  const [loadingError, setLoadingError] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [done, setDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Generate audio on mount if not yet done
  useEffect(() => {
    if (!generatedLesson?.transcript || plays.length > 0) return;
    fetch('/api/lesson/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: generatedLesson.transcript, userName: profile.name }),
    })
      .then((r) => r.json())
      .then((data) => {
        const newPlays: LessonPlay[] = data.plays ?? [];
        setPlays(newPlays);
        setLoading(false);
        if (generatedLesson) {
          setGeneratedLesson({ ...generatedLesson, plays: newPlays });
        }
      })
      .catch(() => {
        setLoading(false);
        setLoadingError(true);
      });
  }, []);

  // Auto-play current segment when index changes or loading finishes
  useEffect(() => {
    if (loading || plays.length === 0 || waitingForUser || done) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = plays[playIndex]?.audioUrl ?? '';
    audio.load();
    audio.play().catch(() => {});
    setIsPlaying(true);
  }, [playIndex, loading, plays]);

  function handleAudioEnded() {
    setIsPlaying(false);
    const current = plays[playIndex];
    if (!current) return;
    if (current.promptAfter) {
      setWaitingForUser(true);
    } else {
      advanceOrFinish();
    }
  }

  function advanceOrFinish() {
    if (playIndex + 1 >= plays.length) {
      setDone(true);
    } else {
      setPlayIndex((i) => i + 1);
    }
  }

  function handleContinue() {
    setWaitingForUser(false);
    advanceOrFinish();
  }

  if (!generatedLesson) {
    return (
      <>
        <BrandBar label="Lesson" />
        <div className="page-narrow fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
          <p className="lede">No lesson found.</p>
          <button className="btn btn-ghost" onClick={() => router.push('/level-result')}>Go back</button>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <BrandBar label="Lesson" />
        <div className="page-narrow fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24, textAlign: 'center' }}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
          <div className="col gap-2" style={{ alignItems: 'center' }}>
            <p className="serif" style={{ fontSize: 24 }}>Preparing your lesson…</p>
            <p className="small" style={{ color: 'var(--mute)', maxWidth: 340 }}>
              Generating personalized audio. This takes about 30–60 seconds.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (loadingError) {
    return (
      <>
        <BrandBar label="Lesson" />
        <div className="page-narrow fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
          <p className="lede" style={{ color: 'var(--crit)' }}>Failed to generate audio.</p>
          <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>Back to dashboard</button>
        </div>
      </>
    );
  }

  if (done) {
    return (
      <>
        <BrandBar label="Lesson complete" />
        <div className="page-narrow fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20, textAlign: 'center' }}>
          <span className="eyebrow eyebrow-warm">Lesson complete</span>
          <h1 className="ty-h1">{generatedLesson.title}</h1>
          <p className="lede" style={{ maxWidth: 480 }}>
            Great work. The patterns from this lesson will reinforce over the next few sessions.
          </p>
          <div className="row gap-3" style={{ marginTop: 8 }}>
            <button className="btn btn-warm" onClick={() => router.push('/dashboard')}>Back to dashboard <Icons.arrow /></button>
          </div>
        </div>
      </>
    );
  }

  const currentPlay = plays[playIndex];
  const progress = plays.length > 0 ? (playIndex / plays.length) * 100 : 0;

  return (
    <>
      <BrandBar label={generatedLesson.title} />
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      <div className="page-narrow fade-in">
        <div className="col gap-10" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 48 }}>

          {/* Progress bar */}
          <div style={{ width: '100%', maxWidth: 560 }}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="mono small" style={{ color: 'var(--mute)' }}>
                {playIndex + 1} / {plays.length}
              </span>
              <span className="mono small" style={{ color: 'var(--mute)' }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div style={{ height: 3, background: 'var(--bg-2)', borderRadius: 2 }}>
              <div style={{ height: 3, width: `${progress}%`, background: 'var(--warm)', borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* Waveform */}
          <div style={{ marginTop: 16 }}>
            <Wave count={48} height={44} playing={isPlaying && !waitingForUser} />
          </div>

          {/* State label */}
          {waitingForUser ? (
            <div className="col gap-4" style={{ alignItems: 'center' }}>
              <span className="eyebrow eyebrow-warm">Your turn</span>
              <p className="serif" style={{ fontSize: 22, maxWidth: 520, color: 'var(--ink-2)' }}>
                Say it out loud, then continue.
              </p>
              <button className="btn btn-warm" style={{ marginTop: 8 }} onClick={handleContinue}>
                Continue <Icons.arrow />
              </button>
            </div>
          ) : (
            <div className="col gap-3" style={{ alignItems: 'center' }}>
              <span className="eyebrow" style={{ color: 'var(--mute)' }}>
                {isPlaying ? 'Playing…' : 'Ready'}
              </span>
            </div>
          )}

          {/* Current segment text */}
          {currentPlay?.text && !waitingForUser && (
            <div style={{ maxWidth: 620, padding: '20px 28px', border: '1px solid var(--line)', textAlign: 'left' }}>
              <p className="body" style={{ color: 'var(--ink-2)', lineHeight: 1.7 }}>
                {currentPlay.text}
              </p>
            </div>
          )}

          {/* Exit */}
          <button className="btn btn-text small" style={{ marginTop: 16, color: 'var(--mute)' }} onClick={() => router.push('/dashboard')}>
            Exit lesson
          </button>

        </div>
      </div>
    </>
  );
}
