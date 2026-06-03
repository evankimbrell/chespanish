'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

export function useRecording() {
  const [isRecording, setIsRecording]       = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript]         = useState<string | null>(null);
  const [volume, setVolume]                 = useState(0);
  const [speechOnsetMs, setSpeechOnsetMs]   = useState<number | null>(null);
  const [recordingDurationMs, setRecordingDurationMs] = useState<number | null>(null);

  const mrRef          = useRef<MediaRecorder | null>(null);
  const chunks         = useRef<Blob[]>([]);
  const streamRef      = useRef<MediaStream | null>(null);
  const ctxRef         = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const rafRef         = useRef<number | null>(null);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef   = useRef<number>(0);
  const onsetDetected  = useRef(false);
  const allowEnglishRef = useRef(false);
  const languageRef = useRef<string | undefined>(undefined);
  const onBlobReadyRef = useRef<((blob: Blob) => void) | undefined>(undefined);

  const stopVolume = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setVolume(0);
  }, []);

  const trackVolume = useCallback((analyser: AnalyserNode) => {
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      const normalized = buf.reduce((a, b) => a + b, 0) / buf.length / 128;
      setVolume(normalized);

      // Detect first moment of speech (threshold: >6% of max)
      if (!onsetDetected.current && normalized > 0.06) {
        const onset = Date.now() - startedAtRef.current;
        setSpeechOnsetMs(onset);
        onsetDetected.current = true;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Acquire the mic ONCE and keep it warm. Re-acquiring getUserMedia on every recording
  // (the old behavior) made the mic cold each time and clipped the first word(s). The
  // stream + AudioContext are kept alive for the session and released on unmount.
  const ensureStream = useCallback(async (): Promise<MediaStream> => {
    const existing = streamRef.current;
    if (existing && existing.getAudioTracks().some((t) => t.readyState === 'live')) {
      return existing;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Build the (persistent) analysis graph for this stream.
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    return stream;
  }, []);

  // Pre-warm the mic the moment we know the user is about to answer (best effort).
  // If permission isn't granted yet it throws — that's fine, the next real
  // startRecording() runs from a user gesture and will acquire it.
  const primeMic = useCallback(() => {
    ensureStream().catch(() => {});
  }, [ensureStream]);

  const stopRecording = useCallback(() => {
    if (!mrRef.current || mrRef.current.state === 'inactive') return;
    stopVolume();
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    mrRef.current.onstop = async () => {
      const duration = Date.now() - startedAtRef.current;
      setRecordingDurationMs(duration);
      setIsRecording(false);
      // NOTE: intentionally do NOT stop the stream tracks here — keep the mic warm so the
      // next prompt records instantly. Tracks are released on unmount.

      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      chunks.current = [];

      // If caller supplied onBlobReady, hand off the blob and skip auto-transcription
      if (onBlobReadyRef.current) {
        onBlobReadyRef.current(blob);
        return;
      }

      setIsTranscribing(true);
      try {
        const fd = new FormData();
        fd.append('audio', blob, 'recording.webm');
        if (allowEnglishRef.current) fd.append('allowEnglish', '1');
        if (languageRef.current) fd.append('language', languageRef.current);
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

  const startRecording = useCallback(async (opts?: { allowEnglish?: boolean; language?: string; onBlobReady?: (blob: Blob) => void; maxDurationMs?: number }) => {
    allowEnglishRef.current = opts?.allowEnglish ?? false;
    languageRef.current = opts?.language;
    onBlobReadyRef.current = opts?.onBlobReady;
    setTranscript(null);
    setSpeechOnsetMs(null);
    setRecordingDurationMs(null);
    onsetDetected.current = false;
    startedAtRef.current = Date.now();
    chunks.current = [];

    // Reuse the warm stream + analyser (acquired here only on the very first use).
    const stream = await ensureStream();
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => {});
    if (analyserRef.current) trackVolume(analyserRef.current);

    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    mrRef.current = mr;
    mr.start();
    setIsRecording(true);

    timerRef.current = setTimeout(stopRecording, opts?.maxDurationMs ?? 120_000);
  }, [ensureStream, stopRecording, trackVolume]);

  const reset = useCallback(() => {
    setTranscript(null);
    setIsRecording(false);
    setIsTranscribing(false);
    setVolume(0);
    setSpeechOnsetMs(null);
    setRecordingDurationMs(null);
    onsetDetected.current = false;
  }, []);

  // Release the mic + audio context when the component using this hook unmounts
  // (e.g. leaving the lesson/level test) so the mic indicator turns off.
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
  }, []);

  return {
    startRecording, stopRecording, primeMic,
    isRecording, isTranscribing, transcript, volume,
    speechOnsetMs, recordingDurationMs,
    reset,
  };
}
