'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Wave } from '@/components/ui/wave';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { useTTS } from '@/hooks/use-tts';
import { useRecording } from '@/hooks/use-recording';
import { useAppStore } from '@/lib/store';
import type { GradeResult, PromptMetric } from '@/lib/types';

const PROMPTS = [
  { text: '¿Querés tomar algo antes de ir?',                  hint: 'A friend asks before you head out.',          difficulty: 'A2' },
  { text: '¿Qué hacés los fines de semana?',                  hint: 'Someone is making small talk.',               difficulty: 'A2' },
  { text: 'Necesito que me expliqués cómo llegar al centro.', hint: 'A stranger needs directions.',                difficulty: 'B1' },
  { text: '¿Podés ayudarme con esto un momento?',             hint: 'A colleague needs a hand.',                   difficulty: 'A2' },
  { text: '¿A qué hora cierra el kiosco?',                    hint: "You're passing a corner store.",              difficulty: 'A1' },
  { text: 'Che, ¿dónde está la parada del bondi?',            hint: 'Someone stops you on the street.',            difficulty: 'A2' },
  { text: 'Tenés que llamar al encargado del edificio.',       hint: 'Your neighbor gives you advice.',             difficulty: 'B1' },
  { text: '¿Vos sos el que reservó la mesa para las ocho?',   hint: 'The host checks at a restaurant.',            difficulty: 'B1' },
  { text: 'No sé si voy a poder ir esta noche.',               hint: 'A friend is unsure about plans.',             difficulty: 'B1' },
  { text: 'Mirá, lo que te digo es importante para el trabajo.', hint: 'A coworker wants your attention.',          difficulty: 'B1' },
  { text: 'Necesito alquilar un departamento por un mes.',     hint: "You're speaking to a real estate agent.",     difficulty: 'B1' },
  { text: 'La verdad, no entendí bien lo que me dijiste.',     hint: 'You need clarification.',                    difficulty: 'A2' },
];

function scoreToTagKind(score: number): 'crit' | 'mute' | 'leaf' | 'warm' {
  if (score <= 1) return 'crit';
  if (score === 2) return 'mute';
  if (score === 3) return 'leaf';
  return 'warm';
}

function calcWPM(text: string | null, durationMs: number | null, onsetMs: number | null): number | null {
  if (!text || !durationMs) return null;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return null;
  const speechMs = durationMs - (onsetMs ?? 0);
  if (speechMs <= 0) return null;
  return Math.round(words / (speechMs / 60000));
}

export default function LevelTestPage() {
  const [step, setStep] = useState(0);
  const [showText, setShowText] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const router = useRouter();

  const startLevelTestSession = useAppStore((s) => s.startLevelTestSession);
  const addPromptMetric = useAppStore((s) => s.addPromptMetric);
  const completeLevelTestSession = useAppStore((s) => s.completeLevelTestSession);
  const profile = useAppStore((s) => s.profile);

  const { play, stop: stopTTS, isLoading: ttsLoading, isPlaying } = useTTS();
  const {
    startRecording, stopRecording,
    isRecording, isTranscribing, transcript, volume,
    speechOnsetMs, recordingDurationMs,
    reset,
  } = useRecording();

  const prompt = PROMPTS[step];
  const done = transcript !== null;

  // Timing refs
  const promptReadyTimeRef = useRef<number>(Date.now());
  const recordPressTimeRef = useRef<number>(0);

  // Start session on mount
  useEffect(() => {
    startLevelTestSession(profile.comfortLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-play the prompt when the step changes
  useEffect(() => {
    promptReadyTimeRef.current = Date.now();
    setGradeResult(null);
    setIsGrading(false);
    play(prompt.text);
    setShowText(false);
    reset();
    return () => stopTTS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Auto-grade when transcript arrives
  useEffect(() => {
    if (!transcript) return;
    setIsGrading(true);
    fetch('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptText: prompt.text,
        promptHint: prompt.hint,
        promptDifficulty: prompt.difficulty,
        transcript,
        responseLatencyMs: recordPressTimeRef.current - promptReadyTimeRef.current,
        speechOnsetMs,
        recordingDurationMs: recordingDurationMs ?? 0,
      }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.score != null) setGradeResult(data as GradeResult); })
      .catch(() => {})
      .finally(() => setIsGrading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  const buildMetric = (skipped: boolean): PromptMetric => ({
    promptIndex: step,
    promptText: prompt.text,
    transcript: skipped ? null : transcript,
    skipped,
    responseLatencyMs: recordPressTimeRef.current - promptReadyTimeRef.current,
    speechOnsetMs,
    recordingDurationMs,
    wordsPerMinute: calcWPM(transcript, recordingDurationMs, speechOnsetMs),
    grade: skipped ? null : gradeResult,
  });

  const handleMic = () => {
    if (isRecording) {
      stopRecording();
    } else {
      recordPressTimeRef.current = Date.now();
      stopTTS();
      startRecording();
    }
  };

  const next = () => {
    addPromptMetric(buildMetric(false));
    reset();
    setShowText(false);
    if (step < PROMPTS.length - 1) {
      setStep((s) => s + 1);
    } else {
      completeLevelTestSession();
      router.push('/level-result');
    }
  };

  const skip = () => {
    addPromptMetric(buildMetric(true));
    stopRecording();
    reset();
    setGradeResult(null);
    setIsGrading(false);
    setShowText(false);
    if (step < PROMPTS.length - 1) {
      setStep((s) => s + 1);
    } else {
      completeLevelTestSession();
      router.push('/level-result');
    }
  };

  // Mic button scale: breathes with real audio volume while recording
  const micScale = isRecording ? 1 + volume * 0.5 : 1;

  return (
    <>
      <BrandBar label="02 Level test" />
      <div className="page-narrow fade-in">
        <div className="row between" style={{ marginBottom: 48 }}>
          <div className="col gap-2">
            <span className="eyebrow">Level Test</span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--mute)' }}>
              {String(step + 1).padStart(2, '0')} / {PROMPTS.length}
            </span>
          </div>
          <button className="btn btn-text small" onClick={() => router.push('/welcome')}>Exit test</button>
        </div>

        <div className="progress" style={{ marginBottom: 64 }}>
          <div className="progress-fill" style={{ width: `${((step + 1) / PROMPTS.length) * 100}%` }} />
        </div>

        <div className="col gap-8" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="eyebrow eyebrow-warm">Prompt · listen and respond</span>

          {/* Audio playback row */}
          <div className="col gap-6" style={{ alignItems: 'center' }}>
            <div className="row gap-4" style={{ alignItems: 'center' }}>
              <button
                className="btn btn-icon btn-ghost"
                style={{ width: 64, height: 64, borderRadius: '50%' }}
                onClick={() => isPlaying ? stopTTS() : play(prompt.text)}
                disabled={ttsLoading || isRecording}
              >
                {ttsLoading ? <span className="spinner" /> : isPlaying ? <Icons.pause /> : <Icons.play />}
              </button>
              <Wave count={48} height={44} playing={isPlaying} />
              <span className="mono small" style={{ color: isPlaying ? 'var(--warm)' : 'var(--mute)', minWidth: 12 }}>
                {isPlaying ? '●' : '○'}
              </span>
            </div>

            {showText && (
              <p className="serif" style={{ fontSize: 32, letterSpacing: '-.01em', maxWidth: 680, fontStyle: 'italic' }}>
                &ldquo;{prompt.text}&rdquo;
              </p>
            )}
            <button className="btn btn-text small" onClick={() => setShowText((s) => !s)}>
              {showText ? 'Hide text' : 'Show text'}
            </button>
          </div>

          <p className="lede" style={{ maxWidth: 520 }}>{prompt.hint}</p>

          {/* Mic button */}
          <div className="col gap-4" style={{ alignItems: 'center', marginTop: 16 }}>
            <button
              className={'mic-btn' + (isRecording ? ' recording' : '')}
              disabled={done || isTranscribing}
              onClick={handleMic}
              style={{
                transform: `scale(${micScale})`,
                transition: isRecording ? 'transform 0.05s ease' : 'transform 0.2s ease',
              }}
            >
              <Icons.mic />
            </button>

            <span className="mono small" style={{ color: isRecording ? 'var(--crit)' : 'var(--mute)' }}>
              {isTranscribing
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Transcribing…
                  </span>
                : isRecording
                  ? '● Recording · tap to stop'
                  : done
                    ? 'Response captured'
                    : 'Tap to respond'}
            </span>
          </div>

          {/* Transcript + grade card */}
          {done && transcript && (
            <div className="card fade-in" style={{ maxWidth: 560, width: '100%', textAlign: 'left' }}>
              <span className="eyebrow">You said</span>
              <p className="serif" style={{ fontSize: 22, marginTop: 8, fontStyle: 'italic' }}>
                &ldquo;{transcript}&rdquo;
              </p>
              <hr className="divider" style={{ margin: '14px 0' }} />
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                {isGrading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    <span className="small" style={{ color: 'var(--mute)' }}>Grading…</span>
                  </span>
                ) : gradeResult ? (
                  <>
                    <Tag kind={scoreToTagKind(gradeResult.score)}>● {gradeResult.label}</Tag>
                    <span className="small">{gradeResult.feedback}</span>
                  </>
                ) : (
                  <>
                    <Tag kind="mute">● Recorded</Tag>
                    <span className="small">Feedback unavailable · continuing.</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="row gap-3">
            <button className="btn btn-ghost" onClick={skip}>Skip</button>
            <button className="btn btn-primary" disabled={!done} onClick={next}>
              Continue <Icons.arrow />
            </button>
          </div>

          <div className="row gap-3" style={{ marginTop: 24, padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, maxWidth: 520 }}>
            <span className="mate-icon" style={{ marginTop: 4 }} />
            <span className="small" style={{ textAlign: 'left' }}>
              Brief feedback only during the test. We&rsquo;ll save corrections and show a full profile at the end.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
