'use client';
import { useState, useRef, useCallback } from 'react';

export function useTTS() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
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

  const play = useCallback(async (text: string, voiceId?: string) => {
    stop();
    setIsLoading(true);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      });

      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

      // Collect the stream into a blob — ElevenLabs turbo streams fast so
      // the full audio arrives well before the first chunk would finish playing
      const blob = await res.blob();
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
      console.error('TTS error:', e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [stop]);

  return { play, stop, isLoading, isPlaying };
}
