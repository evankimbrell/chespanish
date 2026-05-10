'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Wave } from '@/components/ui/wave';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { useTTS } from '@/hooks/use-tts';

const PROMPTS = [
  { text: '¿Querés tomar algo antes de ir?',               hint: 'A friend asks before you head out.' },
  { text: '¿Qué hacés los fines de semana?',               hint: 'Someone is making small talk.' },
  { text: 'Necesito que me expliqués cómo llegar al centro.', hint: 'A stranger needs directions.' },
  { text: '¿Podés ayudarme con esto un momento?',           hint: 'A colleague needs a hand.' },
  { text: '¿A qué hora cierra el kiosco?',                 hint: 'You\'re passing a corner store.' },
  { text: 'Che, ¿dónde está la parada del bondi?',         hint: 'Someone stops you on the street.' },
  { text: 'Tenés que llamar al encargado del edificio.',   hint: 'Your neighbor gives you advice.' },
  { text: '¿Vos sos el que reservó la mesa para las ocho?', hint: 'The host checks at a restaurant.' },
  { text: 'No sé si voy a poder ir esta noche.',           hint: 'A friend is unsure about plans.' },
  { text: 'Mirá, lo que te digo es importante para el trabajo.', hint: 'A coworker wants your attention.' },
  { text: 'Necesito alquilar un departamento por un mes.', hint: 'You\'re speaking to a real estate agent.' },
  { text: 'La verdad, no entendí bien lo que me dijiste.', hint: 'You need clarification.' },
];

export default function LevelTestPage() {
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);
  const [showText, setShowText] = useState(false);
  const router = useRouter();
  const { play, stop, isLoading, isPlaying } = useTTS();

  const prompt = PROMPTS[step];

  // Auto-play the prompt when the step changes
  useEffect(() => {
    play('A dónde vas');
    setShowText(false);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const record = () => {
    stop();
    setRecording(true);
    setTimeout(() => { setRecording(false); setDone(true); }, 2200);
  };

  const next = () => {
    setDone(false);
    setShowText(false);
    if (step < PROMPTS.length - 1) setStep((s) => s + 1);
    else router.push('/level-result');
  };

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

          <div className="col gap-6" style={{ alignItems: 'center' }}>
            <div className="row gap-4" style={{ alignItems: 'center' }}>
              <button
                className="btn btn-icon btn-ghost"
                style={{ width: 64, height: 64, borderRadius: '50%', position: 'relative' }}
                onClick={() => isPlaying ? stop() : play('A dónde vas')}
                disabled={isLoading}
              >
                {isLoading
                  ? <span className="spinner" />
                  : isPlaying
                    ? <Icons.pause />
                    : <Icons.play />}
              </button>
              <Wave count={48} height={44} playing={isPlaying} />
              <span className="mono small" style={{ color: isPlaying ? 'var(--warm)' : 'var(--mute)', minWidth: 32 }}>
                {isLoading ? '…' : isPlaying ? '●' : '○'}
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

          <div className="col gap-4" style={{ alignItems: 'center', marginTop: 16 }}>
            <button
              className={'mic-btn' + (recording ? ' recording' : '')}
              disabled={done || isLoading}
              onClick={record}
            >
              <Icons.mic />
            </button>
            <span className="mono small" style={{ color: recording ? 'var(--crit)' : 'var(--mute)' }}>
              {recording ? '● RECORDING · 00:02' : done ? 'Response captured' : 'Tap to respond'}
            </span>
          </div>

          {done && (
            <div className="card fade-in" style={{ maxWidth: 560, width: '100%', textAlign: 'left' }}>
              <span className="eyebrow">You said</span>
              <p className="serif" style={{ fontSize: 22, marginTop: 8, fontStyle: 'italic' }}>
                &ldquo;Sí, vamos a tomar un café.&rdquo;
              </p>
              <hr className="divider" style={{ margin: '14px 0' }} />
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                <Tag kind="leaf">● Good</Tag>
                <span className="small">Marked for review · feedback after the test.</span>
              </div>
            </div>
          )}

          <div className="row gap-3">
            <button className="btn btn-ghost" onClick={() => { setRecording(false); setDone(false); next(); }}>Skip</button>
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
