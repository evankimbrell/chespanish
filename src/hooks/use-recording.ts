'use client';
import { useState, useRef, useCallback } from 'react';

export function useRecording() {
  const [isRecording, setIsRecording]     = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript]       = useState<string | null>(null);
  const [volume, setVolume]               = useState(0); // 0–1, drives pulse scale

  const mrRef     = useRef<MediaRecorder | null>(null);
  const chunks    = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopVolume = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setVolume(0);
  }, []);

  const trackVolume = useCallback((analyser: AnalyserNode) => {
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      setVolume(buf.reduce((a, b) => a + b, 0) / buf.length / 128);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRecording = useCallback(() => {
    if (!mrRef.current || mrRef.current.state === 'inactive') return;
    stopVolume();
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    mrRef.current.onstop = async () => {
      setIsRecording(false);
      setIsTranscribing(true);
      streamRef.current?.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      chunks.current = [];

      try {
        const fd = new FormData();
        fd.append('audio', blob, 'recording.webm');
        const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Transcribe failed: ${res.status}`);
        const data = await res.json();
        setTranscript(data.transcript ?? null);
      } catch (e) {
        console.error('[recording] transcription error:', e);
        setTranscript(null);
      } finally {
        setIsTranscribing(false);
      }
    };

    mrRef.current.stop();
  }, [stopVolume]);

  const startRecording = useCallback(async () => {
    setTranscript(null);
    chunks.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Wire up volume tracking via Web Audio API
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    trackVolume(analyser);

    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    mrRef.current = mr;
    mr.start();
    setIsRecording(true);

    // Safety auto-stop at 30 s
    timerRef.current = setTimeout(stopRecording, 30_000);
  }, [stopRecording, trackVolume]);

  const reset = useCallback(() => {
    setTranscript(null);
    setIsRecording(false);
    setIsTranscribing(false);
    setVolume(0);
  }, []);

  return { startRecording, stopRecording, isRecording, isTranscribing, transcript, volume, reset };
}
