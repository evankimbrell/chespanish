'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { SAMPLE_TRANSCRIPT } from '@/lib/debug/sample-lesson';

interface ReportSummary {
  filename: string;
  userName: string;
  generatedAt: string;
  title: string;
  hasTranscript: boolean;
  transcript: string | null;
}

export default function DebugPlayerPage() {
  const router = useRouter();
  const setGeneratedLesson = useAppStore((s) => s.setGeneratedLesson);
  const generatedLesson = useAppStore((s) => s.generatedLesson);

  const [mounted, setMounted] = useState(false);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [transcript, setTranscript] = useState(SAMPLE_TRANSCRIPT);
  const [userName, setUserName] = useState('debug');
  const [status, setStatus] = useState<'idle' | 'generating' | 'randomizing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [randomizeProfile, setRandomizeProfile] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch('/api/debug/reports')
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []))
      .catch(() => {});
  }, []);

  const generate = async () => {
    if (!transcript.trim()) return;
    setStatus('generating');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/lesson/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API returned ${res.status}`);
      if (!data.plays?.length) throw new Error('No plays returned');
      setGeneratedLesson({
        transcript,
        plays: data.plays,
        generatedAt: new Date().toISOString(),
        title: 'Debug Lesson',
      });
      router.push('/player');
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    }
  };

  const randomize = async () => {
    setStatus('randomizing');
    setErrorMsg(null);
    setRandomizeProfile(null);
    try {
      const res = await fetch('/api/debug/randomize', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API returned ${res.status}`);
      if (!data.lessonTranscript) throw new Error('No transcript returned');
      setTranscript(data.lessonTranscript);
      setRandomizeProfile(data.profile ?? null);
      setStatus('idle');
      // Reload reports list so new saved report appears
      fetch('/api/debug/reports').then((r) => r.json()).then((d) => setReports(d.reports ?? [])).catch(() => {});
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    }
  };

  const clearCache = () => {
    try { localStorage.removeItem('che_spanish_lesson'); } catch {}
    useAppStore.setState({ generatedLesson: null });
    setStatus('idle');
    setErrorMsg(null);
  };

  const cachedPlays = generatedLesson?.plays?.length ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <span className="mono small" style={{ color: 'var(--mute)', letterSpacing: '0.08em' }}>DEV TOOL</span>
        <h1 className="serif" style={{ fontSize: 32, margin: '8px 0 4px' }}>Debug Player</h1>
        <p className="small" style={{ color: 'var(--mute)' }}>
          Generate audio from a lesson transcript and test it in the OrbPlayer without running a full level test.
        </p>
      </div>

      {/* Saved reports */}
      {reports.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 12 }}>Saved Reports</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
            {reports.map((r) => (
              <button
                key={r.filename}
                onClick={() => r.transcript && setTranscript(r.transcript)}
                disabled={!r.hasTranscript}
                style={{
                  padding: '12px 16px', background: 'var(--bg-2)', border: 'none',
                  borderBottom: '1px solid var(--line)', cursor: r.hasTranscript ? 'pointer' : 'default',
                  textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  opacity: r.hasTranscript ? 1 : 0.5,
                }}
              >
                <div>
                  <span className="small" style={{ display: 'block', fontWeight: 500 }}>{r.userName} — {r.title}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>
                    {r.filename} · {new Date(r.generatedAt).toLocaleString()}
                  </span>
                </div>
                {r.hasTranscript && (
                  <span className="small" style={{ color: 'var(--warm)', whiteSpace: 'nowrap', marginLeft: 12 }}>Load →</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transcript editor */}
      <div style={{ marginBottom: 20 }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Transcript</span>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={14}
          style={{
            width: '100%', padding: '12px 14px', fontFamily: 'monospace', fontSize: 12,
            background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
            color: 'var(--ink)', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
          }}
        />
        <p className="small" style={{ color: 'var(--mute)', marginTop: 6 }}>
          Use <code style={{ background: 'var(--bg-2)', padding: '1px 4px', borderRadius: 2 }}>&lt;English voice&gt;</code>,{' '}
          <code style={{ background: 'var(--bg-2)', padding: '1px 4px', borderRadius: 2 }}>&lt;Spanish voice&gt;</code>, and{' '}
          <code style={{ background: 'var(--bg-2)', padding: '1px 4px', borderRadius: 2 }}>&lt;prompt&gt;</code> tags.
          Each <code style={{ background: 'var(--bg-2)', padding: '1px 4px', borderRadius: 2 }}>&lt;prompt&gt;</code> is a pause point where the user responds.
        </p>
      </div>

      {/* User name */}
      <div style={{ marginBottom: 24 }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>User name (for MP3 file naming)</span>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{
            padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--line)',
            borderRadius: 4, color: 'var(--ink)', fontFamily: 'monospace', fontSize: 13, width: 240,
          }}
        />
      </div>

      {/* Cache status */}
      {mounted && cachedPlays > 0 && (
        <div style={{
          marginBottom: 16, padding: '12px 16px',
          background: 'rgba(var(--leaf-rgb, 80, 140, 80), 0.1)',
          border: '1px solid var(--leaf)', borderRadius: 4,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span className="small">
            Cached lesson in store: <strong>{cachedPlays} plays</strong> — navigating to /player will use this.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/player')}>
            Play cached →
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="row gap-3" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          onClick={generate}
          disabled={status === 'generating' || status === 'randomizing' || !transcript.trim()}
        >
          {status === 'generating' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Generating audio…
            </span>
          ) : (
            'Generate Audio & Play'
          )}
        </button>
        <button
          className="btn btn-ghost"
          onClick={randomize}
          disabled={status === 'generating' || status === 'randomizing'}
        >
          {status === 'randomizing' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Generating transcript…
            </span>
          ) : (
            '⚄ Randomize'
          )}
        </button>
        <button className="btn btn-ghost" onClick={clearCache} disabled={status === 'generating' || status === 'randomizing'}>
          Clear Lesson Cache
        </button>
      </div>

      {status === 'randomizing' && (
        <p className="small" style={{ color: 'var(--mute)' }}>
          Building a fake test session → asking GPT-4o for educator report → generating lesson transcript. Takes ~20-40 seconds.
        </p>
      )}

      {status === 'generating' && (
        <p className="small" style={{ color: 'var(--mute)' }}>
          Calling ElevenLabs for each voice segment — typically 30–60 seconds depending on transcript length.
        </p>
      )}

      {status === 'idle' && randomizeProfile && (
        <p className="small" style={{ color: 'var(--leaf)' }}>
          ✓ Generated {randomizeProfile}-level lesson transcript — review it above, then click Generate Audio &amp; Play.
        </p>
      )}

      {status === 'error' && errorMsg && (
        <p className="small" style={{ color: 'var(--crit)', marginTop: 8 }}>
          Error: {errorMsg}
        </p>
      )}
    </div>
  );
}
