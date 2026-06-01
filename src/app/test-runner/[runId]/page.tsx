'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { TestRun, TestScenario, Bug } from '@/lib/testing/types';

const LABEL_COLORS: Record<string, string> = {
  Excellent: 'var(--warm)',
  Good: 'var(--leaf)',
  Ok: 'var(--mute)',
  Ouch: 'var(--crit)',
  Bad: 'var(--crit)',
  'N/A': 'var(--mute)',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--crit)',
  high: '#f97316',
  medium: 'var(--warm)',
  low: 'var(--mute)',
};

const CATEGORY_ICONS: Record<string, string> = {
  correct: '✓',
  wrong_language: '🌐',
  bad_grammar: '✗',
  incomplete: '…',
  slow: '⏱',
  wrong_answer: '✗',
  silence: '🔇',
};

export default function TestRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const [run, setRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());
  const [fixStatus, setFixStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [fixLog, setFixLog] = useState<{ text: string; kind: 'info' | 'success' | 'warn' | 'error' }[]>([]);
  const [fixSummary, setFixSummary] = useState<string | null>(null);
  const [bugFixStates, setBugFixStates] = useState<Record<string, 'idle' | 'running' | 'done' | 'error'>>({});

  useEffect(() => {
    if (!runId) return;
    fetch(`/api/test-runner/runs/${runId}`)
      .then((r) => r.json())
      .then((d) => {
        setRun(d.run ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [runId]);

  async function runApplyFix(bugId?: string) {
    if (!runId) return;

    const isSingle = !!bugId;

    if (isSingle) {
      setBugFixStates((p) => ({ ...p, [bugId]: 'running' }));
    } else {
      setFixStatus('running');
      setFixLog([{ text: 'Starting fix implementation…', kind: 'info' }]);
      setFixSummary(null);
    }

    try {
      const res = await fetch(`/api/test-runner/runs/${runId}/apply-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bugId ? { bugId } : {}),
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
            if (!isSingle) {
              if (eventName === 'status') {
                setFixLog((p) => [...p, { text: data.message, kind: 'info' }]);
              } else if (eventName === 'files_identified') {
                setFixLog((p) => [...p, { text: data.message, kind: 'info' }]);
              } else if (eventName === 'edit_applied') {
                setFixLog((p) => [...p, { text: `✓ ${data.filePath}: ${data.description}`, kind: 'success' }]);
              } else if (eventName === 'warning') {
                setFixLog((p) => [...p, { text: `⚠ ${data.message}`, kind: 'warn' }]);
              } else if (eventName === 'complete') {
                setFixSummary(data.summary as string);
                setFixStatus('done');
                fetch(`/api/test-runner/runs/${runId}`)
                  .then((r) => r.json())
                  .then((d) => { if (d.run) setRun(d.run); });
              } else if (eventName === 'error') {
                setFixLog((p) => [...p, { text: `Error: ${data.message}`, kind: 'error' }]);
                setFixStatus('error');
              }
            } else {
              if (eventName === 'complete') {
                setBugFixStates((p) => ({ ...p, [bugId]: 'done' }));
                fetch(`/api/test-runner/runs/${runId}`)
                  .then((r) => r.json())
                  .then((d) => { if (d.run) setRun(d.run); });
              } else if (eventName === 'error') {
                setBugFixStates((p) => ({ ...p, [bugId]: 'error' }));
              }
            }
          } catch {}
        }
      }
    } catch (e) {
      if (isSingle && bugId) {
        setBugFixStates((p) => ({ ...p, [bugId]: 'error' }));
      } else {
        setFixLog((p) => [...p, { text: `Fatal: ${String(e)}`, kind: 'error' }]);
        setFixStatus('error');
      }
    }
  }

  function implementFix() { return runApplyFix(); }

  function toggleScenario(id: string) {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px' }}>
        <p className="small" style={{ color: 'var(--mute)' }}>
          Loading…
        </p>
      </div>
    );
  }

  if (!run) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px' }}>
        <p className="small" style={{ color: 'var(--mute)' }}>
          Run not found.
        </p>
        <button className="btn btn-text small" onClick={() => router.push('/test-runner')}>
          ← Back
        </button>
      </div>
    );
  }

  const passed = run.scenarios.filter((s) => s.passed).length;
  const total = run.scenarios.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '40px 24px',
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <button
          className="btn btn-text small"
          onClick={() => router.push('/test-runner')}
          style={{ padding: 0, marginBottom: 12 }}
        >
          ← All runs
        </button>
        <span
          className="mono small"
          style={{ color: 'var(--mute)', letterSpacing: '0.08em', display: 'block' }}
        >
          DEV TOOL · {new Date(run.createdAt).toLocaleString()}
        </span>
        <h1 className="serif" style={{ fontSize: 28, margin: '8px 0 4px' }}>
          Test Run Results
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--mute)',
            marginBottom: 4,
            fontStyle: 'italic',
          }}
        >
          {run.instructions}
        </p>
      </div>

      {/* Status bar */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '16px 20px',
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          marginBottom: 28,
        }}
      >
        <div>
          <div className="mono small" style={{ color: 'var(--mute)', marginBottom: 2 }}>
            STATUS
          </div>
          <div
            className="mono"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color:
                run.status === 'complete'
                  ? 'var(--leaf)'
                  : run.status === 'failed'
                  ? 'var(--crit)'
                  : 'var(--warm)',
              textTransform: 'uppercase',
            }}
          >
            {run.status}
          </div>
        </div>
        <div>
          <div className="mono small" style={{ color: 'var(--mute)', marginBottom: 2 }}>
            PASS RATE
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: passRate >= 80 ? 'var(--leaf)' : passRate >= 50 ? 'var(--warm)' : 'var(--crit)',
            }}
          >
            {passed}/{total} ({passRate}%)
          </div>
        </div>
        <div>
          <div className="mono small" style={{ color: 'var(--mute)', marginBottom: 2 }}>
            BUGS FOUND
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: run.bugs.length > 0 ? 'var(--crit)' : 'var(--leaf)',
            }}
          >
            {run.bugs.length}
          </div>
        </div>
        <div>
          <div className="mono small" style={{ color: 'var(--mute)', marginBottom: 2 }}>
            TARGET
          </div>
          <div className="mono small" style={{ color: 'var(--ink)' }}>
            {run.targetArea}
          </div>
        </div>
      </div>

      {/* Hypothesis */}
      {run.hypothesis && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Hypothesis
          </div>
          <p
            style={{
              fontSize: 14,
              color: 'var(--ink)',
              lineHeight: 1.6,
              padding: '14px 18px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            {run.hypothesis}
          </p>
        </div>
      )}

      {/* Scenarios */}
      {run.scenarios.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Scenarios ({passed}/{total} passed)
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {run.scenarios.map((s, i) => (
              <ScenarioRow
                key={s.id}
                scenario={s}
                isLast={i === run.scenarios.length - 1}
                expanded={expandedScenarios.has(s.id)}
                onToggle={() => toggleScenario(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bugs */}
      {run.bugs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Bugs Found ({run.bugs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {run.bugs.map((bug) => (
              <BugCard
                key={bug.id}
                bug={bug}
                scenarios={run.scenarios}
                fixState={bugFixStates[bug.id] ?? 'idle'}
                onFix={() => runApplyFix(bug.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fix Plan */}
      {run.fixPlan && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Fix Plan
          </div>
          <div
            style={{
              padding: '20px 24px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {run.fixPlan}
          </div>
        </div>
      )}

      {/* Implement Fix Plan */}
      {(run.bugs.length > 0 || run.fixPlan) && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Implement Fix</div>
          <div
            style={{
              padding: '20px 24px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 6,
            }}
          >
            {run.fixesApplied && fixStatus === 'idle' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: 'var(--leaf)',
                  fontSize: 13,
                }}
              >
                <span>✓</span>
                <span>Fixes have already been applied to the codebase.</span>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: fixLog.length > 0 ? 16 : 0 }}>
                  <button
                    className="btn"
                    onClick={implementFix}
                    disabled={fixStatus === 'running' || run.fixesApplied}
                    style={{ marginRight: 12 }}
                  >
                    {fixStatus === 'running'
                      ? 'Applying all fixes…'
                      : fixStatus === 'done'
                      ? 'All fixes applied ✓'
                      : 'Apply All Fixes'}
                  </button>
                  {fixStatus === 'running' && (
                    <span className="mono small" style={{ color: 'var(--warm)' }}>
                      Running…
                    </span>
                  )}
                </div>

                {fixLog.length > 0 && (
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      lineHeight: 1.8,
                      marginBottom: fixSummary ? 16 : 0,
                    }}
                  >
                    {fixLog.map((entry, i) => (
                      <div
                        key={i}
                        style={{
                          color:
                            entry.kind === 'success'
                              ? 'var(--leaf)'
                              : entry.kind === 'error'
                              ? 'var(--crit)'
                              : entry.kind === 'warn'
                              ? 'var(--warm)'
                              : 'var(--mute)',
                        }}
                      >
                        {entry.text}
                      </div>
                    ))}
                  </div>
                )}

                {fixSummary && (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(90,160,100,0.08)',
                      border: '1px solid var(--leaf)',
                      borderRadius: 4,
                      fontSize: 13,
                      color: 'var(--leaf)',
                    }}
                  >
                    {fixSummary}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* All passed case */}
      {run.status === 'complete' && run.bugs.length === 0 && total > 0 && (
        <div
          style={{
            padding: '20px 24px',
            background: 'rgba(var(--leaf-rgb, 90, 160, 100), 0.08)',
            border: '1px solid var(--leaf)',
            borderRadius: 6,
            color: 'var(--leaf)',
            fontSize: 14,
            marginBottom: 28,
          }}
        >
          All {total} scenarios passed. No bugs identified.
        </div>
      )}
    </div>
  );
}

function ScenarioRow({
  scenario,
  isLast,
  expanded,
  onToggle,
}: {
  scenario: TestScenario;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const icon = CATEGORY_ICONS[scenario.category] ?? '?';
  const actualLabel = scenario.grade?.label ?? (scenario.error ? 'Error' : '—');

  return (
    <div
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '14px 18px',
          background: 'var(--bg-2)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: scenario.passed ? 'var(--leaf)' : 'var(--crit)',
            color: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {scenario.passed ? '✓' : '✗'}
        </span>

        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
            {icon} {scenario.name}
          </span>
          <span
            className="mono small"
            style={{ color: 'var(--mute)', marginLeft: 10 }}
          >
            {scenario.category}
          </span>
        </span>

        <div
          className="row gap-2"
          style={{ alignItems: 'center', flexShrink: 0 }}
        >
          <span
            className="mono small"
            style={{ color: 'var(--mute)' }}
          >
            expected:
          </span>
          <span
            className="mono small"
            style={{ color: LABEL_COLORS[scenario.expectedLabel] ?? 'var(--mute)', fontWeight: 700 }}
          >
            {scenario.expectedLabel}
          </span>
          <span className="mono small" style={{ color: 'var(--mute)' }}>
            got:
          </span>
          <span
            className="mono small"
            style={{ color: LABEL_COLORS[actualLabel] ?? 'var(--mute)', fontWeight: 700 }}
          >
            {actualLabel}
          </span>
          <span className="mono small" style={{ color: 'var(--mute)', marginLeft: 8 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div
          style={{
            padding: '12px 18px 18px 52px',
            background: 'var(--bg)',
            borderTop: '1px solid var(--line)',
          }}
        >
          {/* Prompt */}
          <div style={{ marginBottom: 12 }}>
            <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 3 }}>
              PROMPT ({scenario.promptQuestion.prompt_type} · {scenario.promptQuestion.difficulty_bucket})
            </span>
            <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, fontStyle: 'italic' }}>
              "{scenario.promptQuestion.instruction_text}"
            </p>
          </div>

          {/* Audio played to student */}
          {scenario.promptQuestion.audio_text && (
            <div style={{ marginBottom: 12 }}>
              <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 3 }}>
                AUDIO PLAYED TO STUDENT
              </span>
              <p style={{ fontSize: 13, color: 'var(--warm)', margin: 0, fontStyle: 'italic' }}>
                "{scenario.promptQuestion.audio_text}"
              </p>
            </div>
          )}

          {/* Response generated */}
          <div style={{ marginBottom: 12 }}>
            <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 3 }}>
              RESPONSE GENERATED
            </span>
            <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }}>
              "{scenario.generatedResponse}"
            </p>
          </div>

          {/* Audio params — only for slow scenarios */}
          {scenario.category === 'slow' && (scenario.audioSpeed !== undefined || scenario.deliberatePauses) && (
            <div style={{ marginBottom: 12 }}>
              <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 3 }}>
                AUDIO PARAMS
              </span>
              <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }}>
                Speed: {scenario.audioSpeed !== undefined ? `${Math.round(scenario.audioSpeed * 100)}%` : 'default'}
                {scenario.deliberatePauses && (() => {
                  const injected = (scenario.generatedResponse?.match(/\.\.\./g) || []).length;
                  return `  ·  Deliberate pauses: yes${injected > 0 ? ` (${injected} injected)` : ''}`;
                })()}
              </p>
              {scenario.grade?.speech_metrics && (
                <p style={{ fontSize: 12, color: 'var(--mute)', margin: '4px 0 0', fontFamily: 'monospace' }}>
                  Measured: {scenario.grade.speech_metrics.wpm} WPM
                  {'  ·  '}silence before: {scenario.grade.speech_metrics.initial_silence_sec.toFixed(2)}s
                  {'  ·  '}longest pause: {scenario.grade.speech_metrics.max_pause_sec.toFixed(2)}s
                  {'  ·  '}pauses {'>'}0.5s: {scenario.grade.speech_metrics.medium_pause_count ?? '—'}
                  {'  ·  '}pauses {'>'}{'>'}1s: {scenario.grade.speech_metrics.notable_pause_count}
                  {scenario.grade.speech_metrics.wpm < 110 && (
                    <span style={{ color: 'var(--crit)', marginLeft: 6 }}>⚠ slow WPM</span>
                  )}
                  {scenario.grade.speech_metrics.wpm >= 110 && scenario.grade.speech_metrics.wpm < 125 && (
                    <span style={{ color: 'var(--warm)', marginLeft: 6 }}>⚠ slightly slow</span>
                  )}
                  {(scenario.grade.speech_metrics.max_pause_sec > 2.0 || scenario.grade.speech_metrics.notable_pause_count >= 3) && (
                    <span style={{ color: 'var(--warm)', marginLeft: 6 }}>⚠ significant pauses</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Transcript */}
          <div style={{ marginBottom: 12 }}>
            <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 3 }}>
              WHISPER TRANSCRIPT
            </span>
            <p style={{ fontSize: 13, color: scenario.transcript ? 'var(--ink)' : 'var(--mute)', margin: 0 }}>
              {scenario.transcript ?? '(none)'}
            </p>
          </div>

          {/* Grade */}
          {scenario.grade && (
            <div style={{ marginBottom: 12 }}>
              <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 6 }}>
                GRADE RESULT
              </span>
              <div className="row gap-2" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 3,
                    background: (LABEL_COLORS[scenario.grade.label] ?? 'var(--mute)') + '22',
                    color: LABEL_COLORS[scenario.grade.label] ?? 'var(--mute)',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {scenario.grade.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink)' }}>
                  {scenario.grade.brief_feedback}
                </span>
              </div>
              {(scenario.grade.observed_errors?.length ?? 0) > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                  {scenario.grade.observed_errors.map((e, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 2 }}>
                      <strong>{e.category}</strong>: {e.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Failure reason */}
          {!scenario.passed && scenario.failureReason && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(var(--crit-rgb, 220, 80, 80), 0.08)',
                border: '1px solid var(--crit)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--crit)',
              }}
            >
              {scenario.failureReason}
            </div>
          )}

          {/* Duration */}
          <div style={{ marginTop: 8 }}>
            <span className="mono small" style={{ color: 'var(--mute)' }}>
              {scenario.durationMs}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function BugCard({
  bug,
  scenarios,
  fixState,
  onFix,
}: {
  bug: Bug;
  scenarios: TestScenario[];
  fixState: 'idle' | 'running' | 'done' | 'error';
  onFix: () => void;
}) {
  const affectedNames = bug.affectedScenarios
    .map((id) => scenarios.find((s) => s.id === id)?.name ?? id)
    .join(', ');

  return (
    <div
      style={{
        padding: '16px 20px',
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        borderRadius: 6,
      }}
    >
      <div
        className="row gap-2"
        style={{ alignItems: 'center', marginBottom: 8 }}
      >
        <span
          className="mono small"
          style={{
            padding: '1px 6px',
            borderRadius: 3,
            background: (SEVERITY_COLORS[bug.severity] ?? 'var(--mute)') + '22',
            color: SEVERITY_COLORS[bug.severity] ?? 'var(--mute)',
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
          }}
        >
          {bug.severity}
        </span>
        <span
          className="mono small"
          style={{
            padding: '1px 6px',
            borderRadius: 3,
            background: 'var(--line)',
            color: 'var(--mute)',
            fontSize: 10,
          }}
        >
          {bug.category}
        </span>
        <span className="mono small" style={{ color: 'var(--mute)' }}>
          {bug.id}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          {fixState === 'done' ? (
            <span className="mono small" style={{ color: 'var(--leaf)' }}>✓ Applied</span>
          ) : fixState === 'error' ? (
            <span className="mono small" style={{ color: 'var(--crit)' }}>✗ Failed</span>
          ) : (
            <button
              className="btn btn-text small"
              onClick={onFix}
              disabled={fixState === 'running'}
              style={{ padding: '2px 8px', fontSize: 11 }}
            >
              {fixState === 'running' ? 'Applying…' : 'Apply Fix'}
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: '0 0 8px' }}>
        {bug.description}
      </p>

      {affectedNames && (
        <p className="small" style={{ color: 'var(--mute)', margin: '0 0 8px' }}>
          Affected: {affectedNames}
        </p>
      )}

      <div
        style={{
          padding: '8px 12px',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 4,
          fontSize: 12,
          color: 'var(--ink)',
          lineHeight: 1.5,
        }}
      >
        <span className="mono small" style={{ color: 'var(--warm)', display: 'block', marginBottom: 3 }}>
          SUGGESTED FIX
        </span>
        {bug.suggestedFix}
      </div>
    </div>
  );
}
