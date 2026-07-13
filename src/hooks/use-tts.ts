'use client';
import { useState, useRef, useCallback } from 'react';

export function useTTS() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    // Cancel any in-flight fetch so a second play() can't echo over the first
    abortRef.current?.abort();
    abortRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Live TTS through /api/tts — synthesizes on demand and plays the blob.
  const playLive = useCallback(async (text: string, voiceId?: string) => {
    stop();

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

      const blob = await res.blob();

      // Guard: if stop() was called while the blob was downloading, bail out
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      };
      audio.onerror = () => {
        setIsLoading(false);
        setIsPlaying(false);
      };

      await audio.play();
      setIsLoading(false);
      setIsPlaying(true);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // intentionally cancelled
      console.error('TTS error:', e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [stop]);

  // srcUrl: a pre-generated audio file (e.g. /vocab-audio/<hash>.mp3) — plays
  // immediately via the media element (range requests, no blob download). Without
  // it, falls back to live TTS, which synthesizes on demand.
  const play = useCallback(async (text: string, voiceId?: string, srcUrl?: string | null) => {
    if (!srcUrl) return playLive(text, voiceId);

    stop();

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);

    try {
      const audio = new Audio(srcUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      // A stale URL (file pruned, cache moved) must still make a sound — retry
      // through the live-TTS path instead of failing silently.
      audio.onerror = () => {
        if (controller.signal.aborted) return;
        void playLive(text, voiceId);
      };
      await audio.play();
      setIsLoading(false);
      setIsPlaying(true);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // intentionally cancelled
      console.error('TTS error:', e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [stop, playLive]);

  return { play, stop, isLoading, isPlaying };
}
