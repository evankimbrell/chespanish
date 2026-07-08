'use client';
import { useState } from 'react';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { useRecording } from '@/hooks/use-recording';

interface BenchSide {
  ok: boolean;
  provider: string;
  latencyMs?: number;
  text?: string;
  wordCount?: number;
  durationSec?: number;
  detectedLanguage?: string;
  error?: string;
}

interface BenchRun {
  at: string;
  language: string;
  whisper: BenchSide;
  elevenlabs: BenchSide;
}

// Side-by-side STT benchmark: record once, transcribe with Whisper AND ElevenLabs
// Scribe, compare transcripts + latency. Say deliberately messy things (false starts,
// filler, mixed English) to judge which is more verbatim.
export default function TranscribeBenchPage() {
  const { startRecording, stopRecording, isRecording } = useRecording();
  const [language, setLanguage] = useState<'auto' | 'es' | 'en'>('auto');
  const [pending, setPending] = useState(false);
  const [runs, setRuns] = useState<BenchRun[]>([]);

  const onBlob = async (blob: Blob) => {
    setPending(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'bench.webm');
      if (language !== 'auto') fd.append('language', language);
      const res = await fetch('/api/transcribe-bench', { method: 'POST', body: fd });
      const data = await res.json();
      setRuns((r) => [{ at: new Date().toLocaleTimeString(), language, whisper: data.whisper, elevenlabs: data.elevenlabs }, ...r]);
    } catch (e) {
      console.error('[bench] failed:', e);
    } finally {
      setPending(false);
    }
  };

  const toggle = () => {
    if (isRecording) stopRecording();
    else startRecording({ onBlobReady: onBlob });
  };

  const Side = ({ s }: { s: BenchSide }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="row gap-2" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <span className="eyebrow">{s.provider}</span>
        {s.ok
          ? <span className="mono" style={{ fontSize: 11, color: 'var(--warm)' }}>{s.latencyMs}ms</span>
          : <span className="mono" style={{ fontSize: 11, color: 'var(--crit)' }}>failed</span>}
        {s.ok && s.detectedLanguage && <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)' }}>{s.detectedLanguage}</span>}
        {s.ok && <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)' }}>{s.wordCount}w</span>}
      </div>
      {s.ok
        ? <p className="serif" style={{ fontSize: 17, fontStyle: 'italic', margin: 0, overflowWrap: 'break-word' }}>&ldquo;{s.text || '(empty)'}&rdquo;</p>
        : <p className="small" style={{ color: 'var(--crit)', margin: 0, overflowWrap: 'break-word' }}>{s.error}</p>}
    </div>
  );

  return (
    <>
      <TopNav />
      <div className="page fade-in">
        <SectionHead
          num="Debug / STT"
          title="Transcription benchmark."
          sub="Each recording runs through Whisper and ElevenLabs Scribe simultaneously. Compare latency and how verbatim each transcript is — try false starts, filler words, and mixed English/Spanish."
        />

        <div className="row gap-3" style={{ alignItems: 'center', marginBottom: 28 }}>
          <button className={`btn ${isRecording ? 'btn-warm' : 'btn-primary'}`} onClick={toggle} disabled={pending}>
            {isRecording ? 'Stop & transcribe' : pending ? 'Transcribing…' : 'Record'}
          </button>
          <div className="row gap-1">
            {(['auto', 'es', 'en'] as const).map((l) => (
              <button
                key={l}
                className="btn btn-text small"
                style={{ color: language === l ? 'var(--warm)' : 'var(--mute)' }}
                onClick={() => setLanguage(l)}
              >
                {l}
              </button>
            ))}
          </div>
          {runs.length > 1 && (
            <span className="mono small" style={{ color: 'var(--mute)', marginLeft: 'auto' }}>
              avg — whisper {avg(runs, 'whisper')}ms · elevenlabs {avg(runs, 'elevenlabs')}ms
            </span>
          )}
        </div>

        <div className="col gap-4">
          {runs.map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '18px 22px' }}>
              <div className="row gap-3" style={{ marginBottom: 12 }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)' }}>#{runs.length - i} · {r.at} · lang: {r.language}</span>
              </div>
              <div className="row gap-6" style={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 16 }}>
                <Side s={r.whisper} />
                <Side s={r.elevenlabs} />
              </div>
            </div>
          ))}
          {runs.length === 0 && !pending && (
            <p className="small" style={{ color: 'var(--mute)' }}>No runs yet — hit Record, say something, hit Stop.</p>
          )}
        </div>
      </div>
    </>
  );
}

function avg(runs: BenchRun[], key: 'whisper' | 'elevenlabs'): number {
  const vals = runs.map((r) => r[key]).filter((s) => s.ok && s.latencyMs != null).map((s) => s.latencyMs!);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}
