'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RunSummary {
  id: string;
  createdAt: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  instructions: string;
  hypothesis: string;
  targetArea: string;
  scenariosTotal: number;
  scenariosPassed: number;
  bugsFound: number;
  verificationRun: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--mute)',
  running: 'var(--warm)',
  complete: 'var(--leaf)',
  failed: 'var(--crit)',
};

export default function TestRunnerPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [targetArea, setTargetArea] = useState<string>('grading');
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  function loadRuns() {
    fetch('/api/test-runner/runs')
      .then((r) => r.json())
      .then((d) => {
        setRuns(d.runs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function startRun() {
    if (!instructions.trim()) return;
    setRunning(true);
    setRunLog(['Starting test run…']);
    setCurrentRunId(null);

    try {
      const res = await fetch('/api/test-runner/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructions.trim(), targetArea }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          const eventLine = lines.find((l) => l.startsWith('event:'));
          const dataLine = lines.find((l) => l.startsWith('data:'));
          if (!dataLine) continue;

          const eventName = eventLine?.replace('event:', '').trim() ?? 'message';
          try {
            const data = JSON.parse(dataLine.replace('data:', '').trim());

            if (eventName === 'status') {
              setRunLog((prev) => [...prev, data.message]);
            } else if (eventName === 'hypothesis') {
              setRunLog((prev) => [
                ...prev,
                `Hypothesis: ${data.hypothesis.slice(0, 100)}…`,
                `Planning ${data.scenariosPlanned} scenarios`,
              ]);
            } else if (eventName === 'scenario_result') {
              const icon = data.passed ? '✓' : '✗';
              setRunLog((prev) => [
                ...prev,
                `${icon} ${data.name}: ${data.passed ? 'passed' : data.failureReason}`,
              ]);
            } else if (eventName === 'complete') {
              setCurrentRunId(data.runId);
              setRunLog((prev) => [
                ...prev,
                `Done — ${data.passed}/${data.total} passed, ${data.bugsFound} bug(s) found`,
              ]);
            } else if (eventName === 'error') {
              setRunLog((prev) => [...prev, `Error: ${data.message}`]);
            } else if (eventName === 'warning') {
              setRunLog((prev) => [...prev, `Warning: ${data.message}`]);
            }
          } catch {}
        }
      }
    } catch (e) {
      setRunLog((prev) => [...prev, `Fatal error: ${String(e)}`]);
    } finally {
      setRunning(false);
      loadRuns();
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '40px 24px',
        maxWidth: 860,
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <span
          className="mono small"
          style={{ color: 'var(--mute)', letterSpacing: '0.08em' }}
        >
          DEV TOOL
        </span>
        <h1 className="serif" style={{ fontSize: 32, margin: '8px 0 4px' }}>
          QA Test Runner
        </h1>
        <p className="small" style={{ color: 'var(--mute)' }}>
          Automated hypothesis-driven testing of transcription + grading accuracy.
        </p>
      </div>

      {/* New run button / form */}
      {!showForm && !running && (
        <button
          className="btn"
          onClick={() => setShowForm(true)}
          style={{ marginBottom: 32 }}
        >
          + New Test Run
        </button>
      )}

      {showForm && !running && (
        <div
          style={{
            marginBottom: 32,
            padding: '24px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 6,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label
              className="mono small"
              style={{ display: 'block', color: 'var(--mute)', marginBottom: 6 }}
            >
              INSTRUCTIONS
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="What should we test? e.g. Test that wrong-language responses are correctly detected as Ouch/Bad"
              rows={3}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 4,
                padding: '10px 12px',
                color: 'var(--ink)',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              className="mono small"
              style={{ display: 'block', color: 'var(--mute)', marginBottom: 6 }}
            >
              TARGET AREA
            </label>
            <select
              value={targetArea}
              onChange={(e) => setTargetArea(e.target.value)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 4,
                padding: '8px 12px',
                color: 'var(--ink)',
                fontSize: 14,
              }}
            >
              <option value="grading">Grading accuracy</option>
              <option value="level-test">Level test flow</option>
              <option value="lesson-player">Lesson player</option>
              <option value="full-flow">Full flow</option>
            </select>
          </div>

          <div className="row gap-2">
            <button
              className="btn"
              onClick={startRun}
              disabled={!instructions.trim()}
            >
              Run Test
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false);
                setInstructions('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Live run log */}
      {(running || (runLog.length > 0 && currentRunId === null && !showForm)) && (
        <div
          style={{
            marginBottom: 32,
            padding: '20px 24px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 6,
          }}
        >
          <div
            className="row"
            style={{ alignItems: 'center', gap: 10, marginBottom: 14 }}
          >
            <span className="eyebrow">Live Output</span>
            {running && (
              <span
                className="mono small"
                style={{ color: 'var(--warm)', animation: 'pulse 1s infinite' }}
              >
                Running…
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: 'var(--ink)',
              lineHeight: 1.8,
            }}
          >
            {runLog.map((line, i) => (
              <div key={i} style={{ color: line.startsWith('✗') ? 'var(--crit)' : line.startsWith('✓') ? 'var(--leaf)' : line.startsWith('Error') ? 'var(--crit)' : 'var(--ink)' }}>
                {line}
              </div>
            ))}
          </div>
          {currentRunId && (
            <button
              className="btn"
              onClick={() => router.push(`/test-runner/${currentRunId}`)}
              style={{ marginTop: 16 }}
            >
              View Full Results →
            </button>
          )}
        </div>
      )}

      {/* Runs list */}
      {loading && (
        <p className="small" style={{ color: 'var(--mute)' }}>
          Loading…
        </p>
      )}

      {!loading && runs.length === 0 && !running && (
        <p className="small" style={{ color: 'var(--mute)' }}>
          No test runs yet. Click "New Test Run" to get started.
        </p>
      )}

      {runs.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
          {runs.map((run, i) => (
            <button
              key={run.id}
              onClick={() => router.push(`/test-runner/${run.id}`)}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'var(--bg-2)',
                border: 'none',
                borderBottom:
                  i < runs.length - 1 ? '1px solid var(--line)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  className="row gap-2"
                  style={{ alignItems: 'center', marginBottom: 4 }}
                >
                  <span
                    className="mono small"
                    style={{
                      background: STATUS_COLORS[run.status] + '22',
                      color: STATUS_COLORS[run.status],
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {run.status}
                  </span>
                  <span className="mono small" style={{ color: 'var(--mute)' }}>
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                  {run.verificationRun && (
                    <span className="mono small" style={{ color: 'var(--leaf)' }}>
                      + verification
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--ink)',
                    margin: '0 0 4px',
                    fontWeight: 500,
                  }}
                >
                  {run.instructions.slice(0, 100)}
                  {run.instructions.length > 100 ? '…' : ''}
                </p>
                {run.hypothesis && (
                  <p
                    className="small"
                    style={{ color: 'var(--mute)', margin: '0 0 6px', fontStyle: 'italic' }}
                  >
                    {run.hypothesis.slice(0, 120)}
                    {run.hypothesis.length > 120 ? '…' : ''}
                  </p>
                )}
                <span className="small" style={{ color: 'var(--mute)' }}>
                  {run.scenariosTotal > 0
                    ? `${run.scenariosPassed}/${run.scenariosTotal} passed`
                    : 'no scenarios'}
                  {run.bugsFound > 0 && (
                    <span style={{ color: 'var(--crit)', marginLeft: 8 }}>
                      {run.bugsFound} bug{run.bugsFound !== 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              </div>
              <span className="small" style={{ color: 'var(--warm)', whiteSpace: 'nowrap' }}>
                View →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
