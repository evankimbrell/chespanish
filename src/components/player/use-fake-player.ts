'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { LESSON, SUBTITLE_LINES } from '@/lib/data';
import type { LessonGrade, PlayerState } from '@/lib/types';

export interface FakePlayer {
  state: PlayerState;
  progress: number;
  promptIdx: number;
  subtitleIdx: number;
  transcript?: string | null;
  audioProgress?: number;
  audioCurrentTime?: number;
  elapsedSeconds?: number;
  totalSeconds?: number;
  regenerating?: boolean;
  play: () => void;
  pause: () => void;
  record: () => void;
  next: () => void;
  retry: () => void;
  seek: (t: number) => void;
  ask: () => void;
  submitQuestion: () => void;
  playCorrect?: () => void;
  grade?: LessonGrade | null;
}

export function useFakePlayer(): FakePlayer {
  const [state, setState] = useState<PlayerState>('idle');
  const [progress, setProgress] = useState(0);
  const [promptIdx, setPromptIdx] = useState(0);
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [prevState, setPrevState] = useState<PlayerState>('idle');

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  const clearSub  = () => { if (subRef.current)  { clearInterval(subRef.current);  subRef.current  = null; } };

  const play = useCallback(() => {
    setState('playing');
    clearTick();
    tickRef.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + 0.005);
        const cur = LESSON.prompts[promptIdx];
        if (cur && next >= cur.t && p < cur.t) {
          clearTick();
          setState('prompting');
          return cur.t;
        }
        if (next >= 1) { clearTick(); setState('complete'); }
        return next;
      });
    }, 80);
    clearSub();
    subRef.current = setInterval(() => setSubtitleIdx((i) => (i + 1) % SUBTITLE_LINES.length), 3200);
  }, [promptIdx]);

  const pause = useCallback(() => { clearTick(); clearSub(); setState('idle'); }, []);
  const seek  = useCallback((t: number) => { setProgress(t); clearTick(); clearSub(); setState('idle'); }, []);

  const record = useCallback(() => {
    setState('recording');
    setTimeout(() => {
      setState('processing');
      setTimeout(() => setState('feedback'), 900);
    }, 2400);
  }, []);

  const next = useCallback(() => {
    if (promptIdx < LESSON.prompts.length - 1) {
      setPromptIdx((i) => i + 1);
      play();
    } else {
      setProgress(1);
      setState('complete');
    }
  }, [promptIdx, play]);

  const retry = useCallback(() => setState('prompting'), []);

  const ask = useCallback(() => {
    setPrevState(state);
    clearTick();
    clearSub();
    setState('asking');
  }, [state]);

  const submitQuestion = useCallback(() => {
    setState('answering');
    setTimeout(() => {
      setState((prev) => {
        const target = prevState === 'playing' ? 'idle' : prevState;
        return target as PlayerState;
      });
    }, 2200);
  }, [prevState]);

  useEffect(() => () => { clearTick(); clearSub(); }, []);

  return { state, progress, promptIdx, subtitleIdx, play, pause, record, next, retry, seek, ask, submitQuestion };
}
