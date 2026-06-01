'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { GeneratedLesson, LessonGrade } from '@/lib/types';
import type { FakePlayer } from './use-fake-player';
import type { PlayerState } from '@/lib/types';
import { useRecording } from '@/hooks/use-recording';

// Shown if grading fails or returns nothing — keeps the UI from hanging on "Grading…".
const GRADE_FALLBACK: LessonGrade = {
  label: 'Ok',
  brief_feedback: 'Grading was unavailable — you can continue.',
  observed_errors: [],
};

export function useGeneratedLessonPlayer(lesson: GeneratedLesson): FakePlayer {
  const plays = lesson.plays;
  const totalCount = lesson.totalCount ?? plays.length;

  const [state, setState] = useState<PlayerState>('idle');
  const [playIdx, setPlayIdx] = useState(0);
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [grade, setGrade] = useState<LessonGrade | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const subRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedIdxRef = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const seekAfterLoadFractionRef = useRef<number | null>(null);
  const playDurationsRef = useRef<number[]>([]); // actual audio duration (seconds) per play index
  const isAskRef = useRef(false);
  const savedAskPositionRef = useRef<{ playIdx: number; fraction: number } | null>(null);
  const answerAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlayIdxRef = useRef<number | null>(null); // target to resume once buffer catches up

  const {
    startRecording, stopRecording,
    reset: resetRecording,
    transcript: recordTranscript,
  } = useRecording();

  const clearSub = () => { if (subRef.current) { clearInterval(subRef.current); subRef.current = null; } };

  const advanceOrComplete = useCallback((idx: number) => {
    if (idx + 1 >= totalCount) {
      setState('complete');
    } else if (idx + 1 >= plays.length) {
      // Ran out of loaded audio — lesson continues but next batch isn't ready yet.
      // Remember the target so we auto-resume once the background load delivers it.
      pendingPlayIdxRef.current = idx + 1;
      setState('idle');
    } else {
      setPlayIdx(idx + 1);
      setState('playing');
    }
  }, [totalCount, plays.length]);

  // Resume from a buffer stall when the next batch of plays arrives.
  useEffect(() => {
    if (pendingPlayIdxRef.current !== null && pendingPlayIdxRef.current < plays.length) {
      const target = pendingPlayIdxRef.current;
      pendingPlayIdxRef.current = null;
      setPlayIdx(target);
      setState('playing');
    }
  }, [plays.length]);

  // Resume lesson at saved position after ask-answer finishes or fails
  const resumeAfterAsk = useCallback(() => {
    answerAudioRef.current = null;
    const saved = savedAskPositionRef.current;
    savedAskPositionRef.current = null;
    if (saved) {
      if (saved.fraction > 0) seekAfterLoadFractionRef.current = saved.fraction;
      loadedIdxRef.current = -1; // force reload so onloadedmetadata fires
      setPlayIdx(saved.playIdx);
    }
    setState('idle');
  }, []);

  // When transcript arrives, route to ask flow or lesson prompt flow
  useEffect(() => {
    if (recordTranscript === null) return;

    if (isAskRef.current) {
      isAskRef.current = false;
      const contextText = plays
        .slice(Math.max(0, playIdx - 2), playIdx + 1)
        .map((p) => p.text)
        .join(' ');
      fetch('/api/lesson/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: recordTranscript, lessonContext: contextText }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.audioUrl) { resumeAfterAsk(); return; }
          const audio = new Audio(data.audioUrl);
          answerAudioRef.current = audio;
          audio.onended = resumeAfterAsk;
          audio.onerror = resumeAfterAsk;
          audio.play().catch(resumeAfterAsk);
        })
        .catch(resumeAfterAsk);
      return;
    }

    // Lesson prompt path
    setTranscript(recordTranscript);
    setState('feedback');
    setGrade(null);
    const currentPlay = plays[playIdx];
    if (currentPlay) {
      fetch('/api/lesson/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: recordTranscript, playText: currentPlay.text, spanishText: currentPlay.spanishText }),
      })
        .then((r) => r.json())
        .then((data) => setGrade(data && data.label ? data : GRADE_FALLBACK))
        .catch(() => setGrade(GRADE_FALLBACK));
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
      setAudioProgress(0);
      setAudioCurrentTime(0);
      // Apply a pending seek fraction once this audio's duration is known
      audio.onloadedmetadata = () => {
        if (seekAfterLoadFractionRef.current !== null && audio.duration > 0) {
          audio.currentTime = seekAfterLoadFractionRef.current * audio.duration;
          setAudioProgress(seekAfterLoadFractionRef.current);
          setAudioCurrentTime(audio.currentTime);
          seekAfterLoadFractionRef.current = null;
        }
      };
    }

    // Always re-attach onended (cleared by cleanup on pause)
    audio.onended = () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      clearSub();
      playDurationsRef.current[currentIdx] = audio.duration || 0;
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
    subRef.current = setInterval(() => setSubtitleIdx((i) => (i + 1) % Math.max(1, totalCount)), 3200);

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
    answerAudioRef.current?.pause();
    clearSub();
  }, []);

  const play = useCallback(() => setState('playing'), []);

  const pause = useCallback(() => {
    pendingPlayIdxRef.current = null; // deliberate pause — don't auto-resume on next batch
    audioRef.current?.pause();
    clearSub();
    setState('idle');
  }, []);

  // Toggle for lesson prompts. Also handles stopping ask recording.
  const record = useCallback(() => {
    if (state === 'asking') {
      // Stop ask recording — transcript effect will handle the rest
      stopRecording();
      setState('answering'); // show spinner immediately
      return;
    }
    if (state === 'recording') {
      stopRecording();
      setState('processing');
    } else {
      isAskRef.current = false;
      setTranscript(null);
      resetRecording();
      startRecording();
      setState('recording');
    }
  }, [state, startRecording, stopRecording, resetRecording]);

  const next = useCallback(() => {
    setGrade(null);
    setTranscript(null);
    resetRecording();
    setAudioProgress(0);
    setAudioCurrentTime(0);
    advanceOrComplete(playIdx);
  }, [playIdx, advanceOrComplete, resetRecording]);

  const retry = useCallback(() => {
    setGrade(null);
    setTranscript(null);
    resetRecording();
    setState('prompting');
  }, [resetRecording]);

  const playCorrect = useCallback(() => {
    const play = plays[playIdx];
    if (!play) return;
    // Prefer the grader's suggested_answer (GPT knows exactly what the student should say),
    // then fall back to spanishText from the lesson, then full audio
    const text = (grade?.suggested_answer ?? play.spanishText)?.trim();
    if (!text) {
      new Audio(play.audioUrl).play().catch(() => {});
      return;
    }
    fetch('/api/lesson/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const blob = new Blob([buf], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        audio.play().catch(() => {});
      })
      .catch(() => {});
  }, [plays, playIdx, grade]);

  const seek = useCallback((t: number) => {
    pendingPlayIdxRef.current = null; // a manual seek overrides any pending buffer-resume
    const clamped = Math.max(0, Math.min(1, t));
    const fractionalIdx = clamped * totalCount;
    const targetIdx = Math.min(Math.floor(fractionalIdx), Math.max(0, plays.length - 1));
    const targetFraction = Math.max(0, fractionalIdx - targetIdx);

    if (targetIdx === playIdx) {
      if (audioRef.current && audioRef.current.duration > 0) {
        audioRef.current.currentTime = targetFraction * audioRef.current.duration;
      }
      setAudioProgress(targetFraction);
      setAudioCurrentTime((audioRef.current?.duration ?? 0) * targetFraction);
    } else {
      seekAfterLoadFractionRef.current = targetFraction;
      setPlayIdx(targetIdx);
      setAudioProgress(targetFraction);
      setAudioCurrentTime(0);
    }

    if (['prompting', 'feedback', 'recording', 'processing', 'complete'].includes(state)) {
      setState('idle');
    }
  }, [totalCount, plays.length, playIdx, state]);
  const ask = useCallback(() => {
    // Block only if already in a recording/answer flow
    if (state === 'recording' || state === 'asking' || state === 'answering') return;
    const fraction = (audioRef.current?.duration ?? 0) > 0
      ? audioRef.current!.currentTime / audioRef.current!.duration
      : audioProgress;
    savedAskPositionRef.current = { playIdx, fraction };
    audioRef.current?.pause();
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    clearSub();
    isAskRef.current = true;
    resetRecording();
    startRecording({ allowEnglish: true });
    setState('asking');
  }, [state, playIdx, audioProgress, startRecording, resetRecording]);
  const submitQuestion = useCallback(() => setState('idle'), []);

  const progress = totalCount > 0 ? (playIdx + audioProgress) / totalCount : 0;

  // Compute actual elapsed time from recorded play durations + current play position
  const completedSecs = playDurationsRef.current
    .slice(0, playIdx)
    .reduce((sum, d) => sum + (d || 0), 0);
  const elapsedSeconds = completedSecs + audioCurrentTime;

  // Estimate total lesson duration from average of recorded plays
  const recordedDurations = playDurationsRef.current.filter(Boolean);
  const avgPlaySecs = recordedDurations.length > 0
    ? recordedDurations.reduce((a, b) => a + b, 0) / recordedDurations.length
    : 30;
  const totalSeconds = totalCount * avgPlaySecs;

  return { state, progress, promptIdx: playIdx, subtitleIdx, transcript, audioProgress, audioCurrentTime, elapsedSeconds, totalSeconds, play, pause, record, next, retry, seek, ask, submitQuestion, playCorrect, grade };
}
