'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import type { SimulationRun, SimulationPrompt } from '@/lib/testing/types';
import type { SkillScores } from '@/lib/types';

const LABEL_COLORS: Record<string, string> = {
  Excellent: 'var(--warm)',
  Good: 'var(--leaf)',
  Ok: 'var(--mute)',
  Ouch: 'var(--crit)',
  Bad: 'var(--crit)',
  'N/A': 'var(--mute)',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--mute)',
  running: 'var(--warm)',
  complete: 'var(--leaf)',
  failed: 'var(--crit)',
};

function SkillBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));
  const color = value >= 7 ? 'var(--leaf)' : value >= 4 ? 'var(--warm)' : 'var(--crit)';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="mono small" style={{ color: 'var(--mute)', fontSize: 11 }}>{label}</span>
        <span className="mono small" style={{ color, fontSize: 11, fontWeight: 700 }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function PromptRow({
  prompt,
  isLast,
}: {
  prompt: SimulationPrompt;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const gradeLabel = prompt.grade?.label ?? 'N/A';
  const score = prompt.grade?.overall_score ?? null;
  const abilityDelta = prompt.abilityAfter - prompt.abilityBefore;
  const deltaColor = abilityDelta > 0.05 ? 'var(--leaf)' : abilityDelta < -0.05 ? 'var(--crit)' : 'var(--mute)';

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'var(--bg-2)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'grid',
          gridTemplateColumns: '28px 110px 1fr 1fr 80px 130px 20px',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <span className="mono small" style={{ color: 'var(--mute)', fontSize: 11 }}>
          {prompt.index + 1}
        </span>
        <span className="mono small" style={{ color: 'var(--ink)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prompt.promptType}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prompt.generatedResponse.slice(0, 60)}{prompt.generatedResponse.length > 60 ? '…' : ''}
        </span>
        <span style={{ fontSize: 12, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prompt.transcript ? `"${prompt.transcript.slice(0, 60)}${prompt.transcript.length > 60 ? '…' : ''}"` : '—'}
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 700,
            color: LABEL_COLORS[gradeLabel] ?? 'var(--mute)',
            padding: '1px 6px',
            background: (LABEL_COLORS[gradeLabel] ?? 'var(--mute)') + '22',
            borderRadius: 3,
            textAlign: 'center',
          }}
        >
          {gradeLabel}{score !== null ? ` (${score})` : ''}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: deltaColor }}>
          {prompt.abilityBefore.toFixed(2)} → {prompt.abilityAfter.toFixed(2)}
        </span>
        <span className="mono small" style={{ color: 'var(--mute)' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '14px 16px 18px', background: 'var(--bg)', borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 14 }}>
            <div>
              <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 4, fontSize: 10 }}>PROMPT TEXT</span>
              <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>"{prompt.promptText}"</p>
              {prompt.audioText && (
                <>
                  <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginTop: 10, marginBottom: 4, fontSize: 10 }}>AUDIO PLAYED</span>
                  <p style={{ fontSize: 12, color: 'var(--warm)', margin: 0, fontStyle: 'italic' }}>"{prompt.audioText}"</p>
                </>
              )}
            </div>
            <div>
              <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 4, fontSize: 10 }}>GENERATED RESPONSE</span>
              <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>"{prompt.generatedResponse}"</p>
              <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginTop: 10, marginBottom: 4, fontSize: 10 }}>TRANSCRIPT</span>
              <p style={{ fontSize: 13, color: prompt.transcript ? 'var(--ink)' : 'var(--mute)', margin: 0 }}>
                {prompt.transcript ?? '(none)'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <span className="mono small" style={{ color: 'var(--mute)', fontSize: 10 }}>
                DIFFICULTY: {prompt.difficultyBucket} ({prompt.difficulty.toFixed(1)})
              </span>
            </div>
            <div>
              <span className="mono small" style={{ color: 'var(--mute)', fontSize: 10 }}>
                DURATION: {prompt.durationMs}ms
              </span>
            </div>
          </div>

          {prompt.grade?.observed_errors && prompt.grade.observed_errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 6, fontSize: 10 }}>OBSERVED ERRORS</span>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {prompt.grade.observed_errors.map((e, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 3 }}>
                    <strong style={{ color: 'var(--crit)' }}>{e.category}</strong>: {e.description}
                    {e.correction && <span style={{ color: 'var(--leaf)' }}> → {e.correction}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prompt.grade?.brief_feedback && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--ink)', fontStyle: 'italic' }}>{prompt.grade.brief_feedback}</span>
            </div>
          )}

          {prompt.error && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,80,80,0.06)', border: '1px solid var(--crit)', borderRadius: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--crit)' }}>Error: {prompt.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AbilityGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="mono small" style={{ color: 'var(--mute)', fontSize: 11 }}>{label}</span>
        <span className="mono small" style={{ color: 'var(--ink)', fontSize: 11, fontWeight: 700 }}>{value.toFixed(2)} / 10</span>
      </div>
      <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: `linear-gradient(to right, var(--crit), var(--warm), var(--leaf))`,
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}

export function SimulationDetail({ run }: { run: SimulationRun }) {
  const router = useRouter();
  const setGeneratedLesson = useAppStore((s) => s.setGeneratedLesson);
  const [briefOpen, setBriefOpen] = useState(false);
  const [lessonStatus, setLessonStatus] = useState<'idle' | 'transcript' | 'audio' | 'error'>('idle');
  const [lessonError, setLessonError] = useState<string | null>(null);

  // Transcript is generated once and cached, then reused by both the "View
  // Transcript" modal and the "Generate Lesson" (audio + play) flow.
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const transcriptRef = useRef<string | null>(null);

  const ensureTranscript = useCallback(async (): Promise<string | null> => {
    if (transcriptRef.current) return transcriptRef.current;
    if (!run.lessonDesignBrief) return null;
    setTranscriptStatus('generating');
    setTranscriptError(null);
    try {
      const res = await fetch('/api/lesson/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonDesignBrief: run.lessonDesignBrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Transcript generation failed');
      transcriptRef.current = data.lessonTranscript;
      setTranscript(data.lessonTranscript);
      setTranscriptStatus('ready');
      return data.lessonTranscript;
    } catch (e) {
      setTranscriptError(String(e));
      setTranscriptStatus('error');
      return null;
    }
  }, [run.lessonDesignBrief]);

  const viewTranscript = useCallback(() => {
    setTranscriptOpen(true);
    void ensureTranscript();
  }, [ensureTranscript]);

  const generateLesson = async () => {
    if (!run.lessonDesignBrief) return;
    setLessonStatus('transcript');
    setLessonError(null);
    try {
      const lessonTranscript = await ensureTranscript();
      if (!lessonTranscript) throw new Error(transcriptError ?? 'Transcript generation failed');

      setLessonStatus('audio');
      const safeUser = run.studentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const audioRes = await fetch('/api/lesson/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: lessonTranscript, userName: safeUser, startIdx: 0, count: 12 }),
      });
      const audioData = await audioRes.json();
      if (!audioRes.ok) throw new Error(audioData.error ?? 'Audio generation failed');

      setGeneratedLesson({
        transcript: lessonTranscript,
        plays: audioData.plays,
        generatedAt: new Date().toISOString(),
        title: run.suggestedLesson?.title ?? 'Lesson',
        totalCount: audioData.totalCount,
        allPlayMeta: audioData.allPlayMeta,
      });

      router.push('/player');
    } catch (e) {
      setLessonError(String(e));
      setLessonStatus('error');
    }
  };

  const r = run.testReport;
  const skills: [keyof SkillScores, string][] = r ? [
    ['listening_comprehension', 'Listening'],
    ['speaking_fluency', 'Fluency'],
    ['grammar_control', 'Grammar'],
    ['vocabulary_range', 'Vocabulary'],
    ['pronunciation_intelligibility', 'Pronunciation'],
    ['response_speed', 'Speed'],
    ['target_style_alignment', 'Argentine Style'],
    ['practical_communication', 'Practical'],
  ] : [];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <span className="mono small" style={{ color: 'var(--mute)', letterSpacing: '0.08em', display: 'block' }}>
          STUDENT SIMULATION · {new Date(run.createdAt).toLocaleString()}
        </span>
        <h1 className="serif" style={{ fontSize: 28, margin: '8px 0 4px' }}>{run.studentName}</h1>
        <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
          <span
            className="mono small"
            style={{
              background: 'var(--warm)22',
              color: 'var(--warm)',
              padding: '2px 8px',
              borderRadius: 3,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {run.designatedLevel} Designated
          </span>
          <span
            className="mono small"
            style={{
              background: STATUS_COLORS[run.status] + '22',
              color: STATUS_COLORS[run.status],
              padding: '2px 8px',
              borderRadius: 3,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {run.status}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {run.lessonDesignBrief && (
        <div className="row gap-2" style={{ marginBottom: 24 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setBriefOpen(true)}
          >
            See Design Brief
          </button>
          <button
            className="btn btn-ghost"
            onClick={viewTranscript}
            disabled={transcriptStatus === 'generating' || lessonStatus === 'transcript' || lessonStatus === 'audio'}
          >
            {transcriptStatus === 'generating' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
                Generating transcript…
              </span>
            ) : transcript ? (
              'View Transcript'
            ) : (
              'Generate Transcript'
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={generateLesson}
            disabled={lessonStatus === 'transcript' || lessonStatus === 'audio' || transcriptStatus === 'generating'}
          >
            {lessonStatus === 'transcript' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
                Generating transcript…
              </span>
            ) : lessonStatus === 'audio' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
                Generating audio…
              </span>
            ) : (
              'Generate Lesson & Play →'
            )}
          </button>
          {lessonStatus === 'transcript' && (
            <span className="small" style={{ color: 'var(--mute)', alignSelf: 'center' }}>
              Writing lesson transcript (~30–60s)…
            </span>
          )}
          {lessonStatus === 'audio' && (
            <span className="small" style={{ color: 'var(--mute)', alignSelf: 'center' }}>
              Generating first 2 min of audio (~15s)…
            </span>
          )}
          {lessonStatus === 'error' && lessonError && (
            <span className="small" style={{ color: 'var(--crit)', alignSelf: 'center' }}>
              {lessonError}
            </span>
          )}
        </div>
      )}

      {/* Design Brief Modal */}
      {briefOpen && run.lessonDesignBrief && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setBriefOpen(false); }}
        >
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8,
            padding: '28px 32px', maxWidth: 820, width: '100%', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span className="eyebrow">Lesson Design Brief</span>
              <button className="btn btn-text small" onClick={() => setBriefOpen(false)} style={{ padding: '4px 10px' }}>
                ✕ Close
              </button>
            </div>
            <div style={{
              overflowY: 'auto', flex: 1, whiteSpace: 'pre-wrap',
              fontSize: 13, lineHeight: 1.75, color: 'var(--ink)',
            }}>
              {run.lessonDesignBrief}
            </div>
          </div>
        </div>
      )}

      {/* Transcript Modal */}
      {transcriptOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setTranscriptOpen(false); }}
        >
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8,
            padding: '28px 32px', maxWidth: 820, width: '100%', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span className="eyebrow">Lesson Transcript</span>
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                {transcript && (
                  <button
                    className="btn btn-text small"
                    onClick={() => navigator.clipboard?.writeText(transcript).catch(() => {})}
                    style={{ padding: '4px 10px' }}
                  >
                    Copy
                  </button>
                )}
                <button className="btn btn-text small" onClick={() => setTranscriptOpen(false)} style={{ padding: '4px 10px' }}>
                  ✕ Close
                </button>
              </div>
            </div>
            {transcriptStatus === 'generating' && !transcript ? (
              <div className="row gap-2" style={{ alignItems: 'center', color: 'var(--mute)', padding: '24px 0' }}>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span className="small">Writing the full lesson transcript — usually 30–60 seconds…</span>
              </div>
            ) : transcriptStatus === 'error' ? (
              <span className="small" style={{ color: 'var(--crit)' }}>{transcriptError}</span>
            ) : (
              <div style={{
                overflowY: 'auto', flex: 1, whiteSpace: 'pre-wrap',
                fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, color: 'var(--ink)',
              }}>
                {transcript}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Persona */}
      {run.persona && (
        <div
          style={{
            padding: '20px 24px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            marginBottom: 20,
          }}
        >
          <div className="mono small" style={{ color: 'var(--warm)', marginBottom: 10, fontSize: 10, letterSpacing: '0.08em' }}>STUDENT PERSONA</div>
          <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 14px', lineHeight: 1.6 }}>{run.persona.background}</p>
          <p style={{ fontSize: 13, color: 'var(--mute)', margin: '0 0 14px', fontStyle: 'italic', lineHeight: 1.5 }}>{run.persona.speechStyle}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div className="mono small" style={{ color: 'var(--mute)', marginBottom: 6, fontSize: 10 }}>ERROR PATTERNS</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {run.persona.errorPatterns.map((e, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--crit)', marginBottom: 3 }}>{e}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mono small" style={{ color: 'var(--mute)', marginBottom: 6, fontSize: 10 }}>STRENGTHS</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {run.persona.strengths.map((s, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--leaf)', marginBottom: 3 }}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Level accuracy card */}
      <div
        style={{
          padding: '20px 24px',
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          marginBottom: 28,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
          <div>
            <div className="mono small" style={{ color: 'var(--mute)', marginBottom: 4, fontSize: 11 }}>DESIGNATED LEVEL</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{run.designatedLevel}</div>
          </div>
          <div>
            <div className="mono small" style={{ color: 'var(--mute)', marginBottom: 4, fontSize: 11 }}>DETECTED LEVEL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{run.detectedLevel ?? '—'}</span>
              {run.levelAccurate !== null && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: run.levelAccurate ? 'var(--leaf)' : 'var(--crit)',
                    padding: '2px 8px',
                    background: (run.levelAccurate ? 'var(--leaf)' : 'var(--crit)') + '22',
                    borderRadius: 3,
                  }}
                >
                  {run.levelAccurate ? '✓ accurate' : '✗ discrepancy'}
                </span>
              )}
            </div>
          </div>
        </div>
        {r && (
          <AbilityGauge value={r.overall_score} label={`Ability estimate · confidence: ${r.confidence}`} />
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 20 }}>
          <span className="mono small" style={{ color: 'var(--mute)', fontSize: 11 }}>
            {run.prompts.length} prompts
          </span>
          {r && (
            <span className="mono small" style={{ color: 'var(--mute)', fontSize: 11 }}>
              CEFR band: {r.cefr_band}
            </span>
          )}
        </div>
      </div>

      {/* Prompt table */}
      {run.prompts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Prompts ({run.prompts.length})</div>

          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 110px 1fr 1fr 80px 130px 20px',
              gap: 12,
              padding: '8px 16px',
              background: 'var(--bg)',
              borderBottom: '1px solid var(--line)',
            }}
          >
            {['#', 'TYPE', 'RESPONSE', 'TRANSCRIPT', 'GRADE', 'ABILITY', ''].map((h) => (
              <span key={h} className="mono small" style={{ color: 'var(--mute)', fontSize: 10 }}>{h}</span>
            ))}
          </div>

          <div style={{ border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
            {run.prompts.map((p, i) => (
              <PromptRow key={p.questionId + i} prompt={p} isLast={i === run.prompts.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* Test Report */}
      {r && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Test Report</div>
          <div
            style={{
              padding: '20px 24px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 6,
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <h2 className="serif" style={{ fontSize: 22, margin: '0 0 4px' }}>{r.display_level}</h2>
              <p style={{ fontSize: 13, color: 'var(--mute)', margin: 0 }}>{r.summary}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 10, fontSize: 11 }}>SKILL SCORES</span>
                {skills.map(([key, label]) => (
                  <SkillBar key={key} label={label} value={r.skill_scores[key]} />
                ))}
              </div>
              <div>
                {r.strengths.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 6, fontSize: 11 }}>STRENGTHS</span>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {r.strengths.map((s, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.weaknesses.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 6, fontSize: 11 }}>WEAKNESSES</span>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {r.weaknesses.map((w, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.most_common_error_categories.length > 0 && (
                  <div>
                    <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 6, fontSize: 11 }}>COMMON ERRORS</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {r.most_common_error_categories.map((e) => (
                        <span
                          key={e}
                          style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            padding: '2px 8px',
                            background: 'var(--crit)22',
                            color: 'var(--crit)',
                            borderRadius: 3,
                          }}
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Educator Report */}
      {run.educatorReport && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Educator Report</div>
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
              maxHeight: 500,
              overflowY: 'auto',
            }}
          >
            {run.educatorReport}
          </div>
        </div>
      )}

      {/* Lesson Design Brief */}
      {run.lessonDesignBrief && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Lesson Design Brief</div>
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
              maxHeight: 500,
              overflowY: 'auto',
            }}
          >
            {run.lessonDesignBrief}
          </div>
        </div>
      )}

      {/* Suggested First Lesson */}
      {run.suggestedLesson && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Suggested First Lesson</div>
          <div
            style={{
              padding: '20px 24px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 6,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: 'var(--ink)' }}>
              {run.suggestedLesson.title}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--mute)', margin: '0 0 12px', fontStyle: 'italic' }}>
              {run.suggestedLesson.scenario}
            </p>
            {run.suggestedLesson.focus_points.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <span className="mono small" style={{ color: 'var(--mute)', display: 'block', marginBottom: 6, fontSize: 11 }}>FOCUS POINTS</span>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {run.suggestedLesson.focus_points.map((fp, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>{fp}</li>
                  ))}
                </ul>
              </div>
            )}
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 4,
                fontSize: 13,
                color: 'var(--ink)',
                lineHeight: 1.5,
              }}
            >
              <span className="mono small" style={{ color: 'var(--warm)', display: 'block', marginBottom: 4, fontSize: 10 }}>WHY</span>
              {run.suggestedLesson.why}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
