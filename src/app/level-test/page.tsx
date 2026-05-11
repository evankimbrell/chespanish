'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Wave } from '@/components/ui/wave';
import { Icons } from '@/components/ui/icons';
import { useTTS } from '@/hooks/use-tts';
import { useRecording } from '@/hooks/use-recording';
import { useAppStore } from '@/lib/store';
import { initEngine, selectNextQuestion, updateEngine } from '@/lib/test-engine';
import { QUESTION_BANK } from '@/lib/question-bank';
import type { GradeResult, PromptMetric, TestEngineState, Question, PromptType } from '@/lib/types';

const TOTAL_QUESTIONS = 12;

const AUDIO_TYPES = new Set<PromptType>([
  'listen_and_respond',
  'listen_for_meaning',
  'mini_dialogue_comprehension',
  'monologue_comprehension',
  'roleplay_response',
]);

const TYPE_LABEL: Record<PromptType, string> = {
  listen_and_respond: 'Listen & respond',
  say_it_in_spanish: 'Say it in Spanish',
  listen_for_meaning: 'Listen for meaning',
  mini_dialogue_comprehension: 'Mini dialogue',
  monologue_comprehension: 'Listen & comprehend',
  roleplay_response: 'Roleplay',
  open_speaking: 'Open speaking',
  practical_problem: 'Practical scenario',
  grammar_in_context: 'Grammar in context',
};

function calcWPM(text: string | null, durationMs: number | null, onsetMs: number | null): number | null {
  if (!text || !durationMs) return null;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return null;
  const speechMs = durationMs - (onsetMs ?? 0);
  if (speechMs <= 0) return null;
  return Math.round(words / (speechMs / 60000));
}

export default function LevelTestPage() {
  const [engine, setEngine] = useState<TestEngineState | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
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

  const done = transcript !== null;
  const promptReadyTimeRef = useRef<number>(Date.now());
  const recordPressTimeRef = useRef<number>(0);

  // Init on mount
  useEffect(() => {
    startLevelTestSession(profile.comfortLevel);
    const eng = initEngine(profile.comfortLevel);
    const first = selectNextQuestion(eng, QUESTION_BANK);
    setEngine(eng);
    setQuestion(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to question changes: play audio if audio type, reset state
  useEffect(() => {
    if (!question) return;
    promptReadyTimeRef.current = Date.now();
    setGradeResult(null);
    setIsGrading(false);
    setShowText(false);
    reset();
    if (question.audio_text) {
      play(question.audio_text);
    }
    return () => stopTTS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  // Auto-grade when transcript arrives
  useEffect(() => {
    if (!transcript || !question) return;
    setIsGrading(true);
    fetch('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptText: question.audio_text ?? question.instruction_text,
        promptHint: question.instruction_text,
        promptDifficulty: question.difficulty_band,
        promptType: question.prompt_type,
        targetAnswer: question.target_answer,
        acceptableExamples: question.acceptable_response_examples,
        scoringNotes: question.scoring_notes,
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

  const buildMetric = (): PromptMetric => ({
    promptIndex: questionNumber - 1,
    questionId: question?.prompt_id ?? '',
    promptType: question?.prompt_type ?? 'listen_and_respond',
    promptText: question?.audio_text ?? question?.instruction_text ?? '',
    transcript,
    skipped: false,
    responseLatencyMs: recordPressTimeRef.current - promptReadyTimeRef.current,
    speechOnsetMs,
    recordingDurationMs,
    wordsPerMinute: calcWPM(transcript, recordingDurationMs, speechOnsetMs),
    grade: gradeResult,
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
    if (!engine || !question) return;
    addPromptMetric(buildMetric());

    if (questionNumber >= TOTAL_QUESTIONS) {
      completeLevelTestSession();
      router.push('/level-result');
      return;
    }

    const rec = gradeResult?.next_question_recommendation ?? 'same';
    const score = gradeResult?.score ?? 3;
    const newEngine = updateEngine(engine, rec, score, question);
    const nextQ = selectNextQuestion(newEngine, QUESTION_BANK);

    setEngine(newEngine);
    setQuestion(nextQ);
    setQuestionNumber((n) => n + 1);
    reset();
    setGradeResult(null);
    setIsGrading(false);
    setShowText(false);
  };

  const micScale = isRecording ? 1 + volume * 0.5 : 1;
  const isAudioType = question ? AUDIO_TYPES.has(question.prompt_type) : true;
  const typeLabel = question ? TYPE_LABEL[question.prompt_type] : 'Listen & respond';

  if (!question) {
    return (
      <>
        <BrandBar label="02 Level test" />
        <div className="page-narrow fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <span className="spinner" />
        </div>
      </>
    );
  }

  return (
    <>
      <BrandBar label="02 Level test" />
      <div className="page-narrow fade-in">
        <div className="row between" style={{ marginBottom: 48 }}>
          <div className="col gap-2">
            <span className="eyebrow">Level Test</span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--mute)' }}>
              {String(questionNumber).padStart(2, '0')} / {TOTAL_QUESTIONS}
            </span>
          </div>
          <button className="btn btn-text small" onClick={() => router.push('/welcome')}>Exit test</button>
        </div>

        <div className="progress" style={{ marginBottom: 64 }}>
          <div className="progress-fill" style={{ width: `${(questionNumber / TOTAL_QUESTIONS) * 100}%` }} />
        </div>

        <div className="col gap-8" style={{ alignItems: 'center', textAlign: 'center' }}>
          {/* Eyebrow: scenario tag (for roleplay) or prompt type */}
          <div className="col gap-2" style={{ alignItems: 'center' }}>
            {question.scenario && (
              <span className="eyebrow" style={{ color: 'var(--mute)' }}>{question.scenario}</span>
            )}
            <span className="eyebrow eyebrow-warm">Prompt · {typeLabel}</span>
          </div>

          {isAudioType ? (
            /* Audio prompt: play button + waveform + optional show text */
            <div className="col gap-6" style={{ alignItems: 'center' }}>
              <div className="row gap-4" style={{ alignItems: 'center' }}>
                <button
                  className="btn btn-icon btn-ghost"
                  style={{ width: 64, height: 64, borderRadius: '50%' }}
                  onClick={() => isPlaying ? stopTTS() : play(question.audio_text!)}
                  disabled={ttsLoading || isRecording}
                >
                  {ttsLoading ? <span className="spinner" /> : isPlaying ? <Icons.pause /> : <Icons.play />}
                </button>
                <Wave count={48} height={44} playing={isPlaying} />
                <span className="mono small" style={{ color: isPlaying ? 'var(--warm)' : 'var(--mute)', minWidth: 12 }}>
                  {isPlaying ? '●' : '○'}
                </span>
              </div>

              <p className="lede" style={{ maxWidth: 520 }}>{question.instruction_text}</p>

              {showText && (
                <p className="serif" style={{ fontSize: 28, letterSpacing: '-.01em', maxWidth: 680, fontStyle: 'italic' }}>
                  &ldquo;{question.audio_text}&rdquo;
                </p>
              )}
              <button className="btn btn-text small" onClick={() => setShowText((s) => !s)}>
                {showText ? 'Hide text' : 'Show text'}
              </button>
            </div>
          ) : (
            /* Text prompt: large display, no audio */
            <div className="col gap-6" style={{ alignItems: 'center', maxWidth: 680 }}>
              <p className="serif" style={{ fontSize: 32, letterSpacing: '-.01em', fontStyle: 'italic', lineHeight: 1.3 }}>
                &ldquo;{question.instruction_text}&rdquo;
              </p>
            </div>
          )}

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
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono small" style={{ color: 'var(--leaf)' }}>✓</span>
                    <span className="small" style={{ color: 'var(--mute)' }}>Graded · proceed to the next question.</span>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="row gap-3">
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
