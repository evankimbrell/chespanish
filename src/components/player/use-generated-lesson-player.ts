'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { GeneratedLesson } from '@/lib/types';
import type { FakePlayer } from './use-fake-player';
import type { PlayerState } from '@/lib/types';
import { useRecording } from '@/hooks/use-recording';

export function useGeneratedLessonPlayer(lesson: GeneratedLesson): FakePlayer {
  const plays = lesson.plays;
  const total = plays.length;

  const [state, setState] = useState<PlayerState>('idle');
  const [playIdx, setPlayIdx] = useState(0);
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const subRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedIdxRef = useRef(-1);
  const rafRef = useRef<number | null>(null);

  const {
    startRecording, stopRecording,
    reset: resetRecording,
    transcript: recordTranscript,
  } = useRecording();

  const clearSub = () => { if (subRef.current) { clearInterval(subRef.current); subRef.current = null; } };

  const advanceOrComplete = useCallback((idx: number) => {
    if (idx + 1 >= total) {
      setState('complete');
    } else {
      setPlayIdx(idx + 1);
      setState('playing');
    }
  }, [total]);

  // When real transcript arrives, move to feedback
  useEffect(() => {
    if (recordTranscript !== null) {
      setTranscript(recordTranscript);
      setState('feedback');
    }
  }, [recordTranscript]);

  // Start/resume audio whenever state becomes 'playing'
  useEffect(() => {
    if (state !== 'playing' || !plays[playIdx]) return;

    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    const currentIdx = playIdx;

    // Only reload src when switching to a different segment — not on resume
    if (loadedIdxRef.current !== currentIdx) {
      loadedIdxRef.current = currentIdx;
      audio.src = plays[currentIdx].audioUrl;
      setAudioProgress(0);  // reset immediately — (playIdx+1)/total == (nextPlayIdx+0)/total, no jump
      setAudioCurrentTime(0);
    }

    // Always re-attach onended (cleared by cleanup on pause)
    audio.onended = () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      clearSub();
      setAudioProgress(1); // hold at end-of-play until next play starts
      setAudioCurrentTime(0);
      if (plays[currentIdx]?.promptAfter) {
        setState('prompting');
      } else {
        advanceOrComplete(currentIdx);
      }
    };

    // Poll at 60fps for smooth word-by-word highlighting
    const pollProgress = () => {
      if (audioRef.current && audioRef.current.duration > 0) {
        const t = audioRef.current.currentTime;
        setAudioProgress(t / audioRef.current.duration);
        setAudioCurrentTime(t);
      }
      rafRef.current = requestAnimationFrame(pollProgress);
    };
    rafRef.current = requestAnimationFrame(pollProgress);

    audio.play().catch(() => {});

    clearSub();
    subRef.current = setInterval(() => setSubtitleIdx((i) => (i + 1) % Math.max(1, total)), 3200);

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      audio.onended = null;
      audio.pause();
      clearSub();
    };
  }, [state, playIdx]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    clearSub();
  }, []);

  const play = useCallback(() => setState('playing'), []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    clearSub();
    setState('idle');
  }, []);

  // Toggle: first call starts recording, second call stops it (triggers transcription)
  const record = useCallback(() => {
    if (state === 'recording') {
      stopRecording();
      setState('processing');
    } else {
      setTranscript(null);
      resetRecording();
      startRecording();
      setState('recording');
    }
  }, [state, startRecording, stopRecording, resetRecording]);

  const next = useCallback(() => {
    setTranscript(null);
    resetRecording();
    advanceOrComplete(playIdx);
  }, [playIdx, advanceOrComplete, resetRecording]);

  const retry = useCallback(() => {
    setTranscript(null);
    resetRecording();
    setState('prompting');
  }, [resetRecording]);

  const seek = useCallback(() => {}, []);
  const ask = useCallback(() => setState('asking'), []);
  const submitQuestion = useCallback(() => setState('idle'), []);

  const progress = total > 0 ? (playIdx + audioProgress) / total : 0;

  return { state, progress, promptIdx: playIdx, subtitleIdx, transcript, audioProgress, audioCurrentTime, play, pause, record, next, retry, seek, ask, submitQuestion };
}
