'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface PromptResult {
  promptIndex: number;
  promptType: string;
  promptBucket: string;
  promptText: string;
  transcript: string | null;
  skipped: boolean;
  overallScore: number | null;
  grade?: {
    label: string;
    brief_feedback: string;
    observed_errors: { category: string; description: string }[];
  } | null;
}

interface UserDetail {
  name: string;
  level: string | null;
  cefrBand: string | null;
  levelTest: {
    completedAt: string;
    report: {
      display_level: string;
      confidence: string;
      confidence_range: [number, number];
      summary: string;
      skill_scores: Record<string, number>;
      strengths: string[];
      weaknesses: string[];
      recommended_first_lesson: {
        title: string;
        scenario: string;
        why: string;
        focus_points: string[];
      };
    } | null;
    educatorReport: string | null;
    prompts: PromptResult[];
    mistakeAnalysis: {
      byCategory: { category: string; count: number; examples: string[] }[];
      total: number;
    };
  } | null;
  lessonHistory: {
    id: string;
    title: string;
    startedAt: string;
    lastAccessedAt: string;
    playIdx: number;
    totalCount: number;
    completed: boolean;
    topics: string[];
  }[];
}

const GRADE_COLORS: Record<string, string> = {
  Excellent: 'var(--warm)',
  Good: 'var(--leaf)',
  Ok: 'var(--mute)',
  Almost: '#c8880a',
  Ouch: 'var(--crit)',
  Bad: 'var(--crit)',
};

const SKILL_LABELS: Record<string, string> = {
  listening_comprehension: 'Listening',
  speaking_fluency: 'Fluency',
  grammar_control: 'Grammar',
  vocabulary_range: 'Vocabulary',
  pronunciation_intelligibility: 'Pronunciation',
  response_speed: 'Response Speed',
  target_style_alignment: 'Argentine Style',
  practical_communication: 'Practical Comms',
};

export default function AdminUserPage() {
  const { user } = useParams<{ user: string }>();
  const router = useRouter();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showEducator, setShowEducator] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${encodeURIComponent(user)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="small" style={{ color: 'var(--mute)' }}>Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px' }}>
        <p className="small" style={{ color: 'var(--crit)' }}>Failed to load user data.</p>
      </div>
    );
  }

  const lt = data.levelTest;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <button className="btn btn-text small" style={{ padding: 0, marginBottom: 12 }} onClick={() => router.push('/admin')}>
          ← All users
        </button>
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <h1 className="serif" style={{ fontSize: 32, margin: 0 }}>{data.name}</h1>
          {data.level && (
            <span className="mono" style={{
              fontSize: 13, padding: '2px 8px', borderRadius: 3,
              background: 'var(--warm)', color: 'var(--bg)', fontWeight: 700,
            }}>{data.level}</span>
          )}
          {!data.level && <span className="small" style={{ color: 'var(--mute)' }}>no level test</span>}
        </div>
      </div>

      {/* Lesson History */}
      <section style={{ marginBottom: 36 }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 12 }}>Lesson History</span>
        {data.lessonHistory.length === 0 ? (
          <p className="small" style={{ color: 'var(--mute)' }}>No lessons started.</p>
        ) : (
          <div style={{ border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
            {data.lessonHistory.map((l, i) => {
              const pct = l.totalCount > 0 ? Math.round((l.playIdx / l.totalCount) * 100) : 0;
              return (
                <div key={l.id} style={{
                  padding: '14px 18px', background: 'var(--bg-2)',
                  borderBottom: i < data.lessonHistory.length - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{l.title}</span>
                    {l.completed
                      ? <span style={{ color: 'var(--leaf)', fontSize: 13 }}>✓ Completed</span>
                      : <span className="small" style={{ color: 'var(--mute)' }}>{pct}% complete</span>
                    }
                  </div>
                  <div style={{ height: 3, background: 'var(--line)', borderRadius: 2, marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${l.completed ? 100 : pct}%`, background: l.completed ? 'var(--leaf)' : 'var(--warm)', borderRadius: 2 }} />
                  </div>
                  <div className="row gap-3">
                    <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>
                      {l.playIdx} / {l.totalCount} plays
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>
                      Started {new Date(l.startedAt).toLocaleDateString()}
                    </span>
                    {l.lastAccessedAt !== l.startedAt && (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>
                        Last accessed {new Date(l.lastAccessedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {l.topics?.length > 0 && (
                    <div className="row gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                      {l.topics.map(t => (
                        <span key={t} className="chip" style={{ fontSize: 11, padding: '1px 7px', cursor: 'default' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="small" style={{ color: 'var(--mute)', marginTop: 8 }}>
          Note: per-prompt responses within lessons are not yet persisted to disk.
        </p>
      </section>

      {/* Mistake Analysis */}
      <section style={{ marginBottom: 36 }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 12 }}>Mistake Analysis</span>
        {!lt ? (
          <p className="small" style={{ color: 'var(--mute)' }}>No level test data available.</p>
        ) : lt.mistakeAnalysis.total === 0 ? (
          <p className="small" style={{ color: 'var(--leaf)' }}>No errors recorded in level test.</p>
        ) : (
          <>
            <p className="small" style={{ color: 'var(--mute)', marginBottom: 12 }}>
              {lt.mistakeAnalysis.total} total errors across {lt.prompts.length} level test prompts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lt.mistakeAnalysis.byCategory.map(cat => (
                <div key={cat.category} style={{
                  padding: '12px 16px', background: 'var(--bg-2)',
                  border: '1px solid var(--line)', borderRadius: 4,
                }}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{cat.category}</span>
                    <span className="mono small" style={{ color: 'var(--crit)' }}>{cat.count}×</span>
                  </div>
                  {cat.examples.map((ex, i) => (
                    <p key={i} className="small" style={{ color: 'var(--mute)', margin: '2px 0', paddingLeft: 12 }}>
                      · {ex}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Level Test Report */}
      {lt?.report && (
        <section style={{ marginBottom: 36 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 12 }}>Level Test Report</span>
          <div style={{ padding: '20px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, marginBottom: 16 }}>
            <div className="row gap-3" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="serif" style={{ fontSize: 22, fontWeight: 600 }}>{lt.report.display_level}</span>
              <span className="small" style={{ color: 'var(--mute)', alignSelf: 'center' }}>
                confidence: {lt.report.confidence} ({lt.report.confidence_range[0].toFixed(1)}–{lt.report.confidence_range[1].toFixed(1)})
              </span>
              <span className="mono small" style={{ color: 'var(--mute)', alignSelf: 'center' }}>
                {new Date(lt.completedAt).toLocaleDateString()}
              </span>
            </div>
            <p className="small" style={{ color: 'var(--ink-2)', marginBottom: 16 }}>{lt.report.summary}</p>

            {/* Skill scores */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 16 }}>
              {Object.entries(lt.report.skill_scores ?? {}).map(([key, val]) => (
                <div key={key}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 3 }}>
                    <span className="small">{SKILL_LABELS[key] ?? key}</span>
                    <span className="mono small" style={{ color: 'var(--mute)' }}>{(val as number).toFixed(1)}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--line)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${((val as number) / 10) * 100}%`, background: 'var(--warm)', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Strengths / Weaknesses */}
            <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
              {lt.report.strengths?.length > 0 && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <span className="eyebrow eyebrow-warm" style={{ display: 'block', marginBottom: 6 }}>Strengths</span>
                  {lt.report.strengths.map((s, i) => (
                    <p key={i} className="small" style={{ color: 'var(--leaf)', margin: '2px 0' }}>✓ {s}</p>
                  ))}
                </div>
              )}
              {lt.report.weaknesses?.length > 0 && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: 6, color: 'var(--crit)' }}>Weaknesses</span>
                  {lt.report.weaknesses.map((w, i) => (
                    <p key={i} className="small" style={{ color: 'var(--mute)', margin: '2px 0' }}>· {w}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Educator report */}
          {lt.educatorReport && (
            <div style={{ marginBottom: 16 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowEducator(v => !v)}
                style={{ marginBottom: 8 }}
              >
                {showEducator ? 'Hide' : 'Show'} educator report
              </button>
              {showEducator && (
                <pre style={{
                  whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12,
                  background: 'var(--bg-2)', border: '1px solid var(--line)',
                  borderRadius: 4, padding: 16, color: 'var(--ink-2)',
                  maxHeight: 400, overflowY: 'auto',
                }}>
                  {lt.educatorReport}
                </pre>
              )}
            </div>
          )}
        </section>
      )}

      {/* Suggested next lesson */}
      {lt?.report?.recommended_first_lesson && (
        <section style={{ marginBottom: 36 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 12 }}>Suggested Next Lesson</span>
          <div style={{ padding: '20px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4 }}>
            <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              {lt.report.recommended_first_lesson.title}
            </p>
            <p className="small" style={{ color: 'var(--mute)', marginBottom: 12 }}>
              {lt.report.recommended_first_lesson.why}
            </p>
            <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
              {lt.report.recommended_first_lesson.focus_points?.map((fp, i) => (
                <span key={i} className="chip" style={{ fontSize: 11, padding: '2px 8px', cursor: 'default' }}>{fp}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Level Test Prompts */}
      {lt && lt.prompts.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="eyebrow">Level Test Prompts ({lt.prompts.length})</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPrompts(v => !v)}>
              {showPrompts ? 'Collapse' : 'Show all'}
            </button>
          </div>

          {showPrompts && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
              {lt.prompts.map((p, i) => (
                <div key={i} style={{
                  padding: '16px 18px', background: i % 2 === 0 ? 'var(--bg-2)' : 'var(--bg)',
                  borderBottom: i < lt.prompts.length - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <div className="row gap-2" style={{ marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="mono small" style={{ color: 'var(--mute)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="chip" style={{ fontSize: 10, padding: '1px 6px', cursor: 'default' }}>
                      {p.promptType?.replace(/_/g, ' ')}
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--mute)' }}>{p.promptBucket}</span>
                    {p.grade?.label && (
                      <span className="mono" style={{
                        fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                        background: `${GRADE_COLORS[p.grade.label] ?? 'var(--mute)'}22`,
                        color: GRADE_COLORS[p.grade.label] ?? 'var(--mute)',
                        marginLeft: 'auto',
                      }}>
                        {p.grade.label}
                      </span>
                    )}
                  </div>

                  <p className="serif" style={{ fontSize: 15, fontStyle: 'italic', marginBottom: 8, color: 'var(--ink)' }}>
                    &ldquo;{p.promptText}&rdquo;
                  </p>

                  {p.skipped ? (
                    <p className="small" style={{ color: 'var(--mute)' }}>Skipped</p>
                  ) : p.transcript ? (
                    <p className="small" style={{ color: 'var(--ink-2)', marginBottom: 4 }}>
                      You said: &ldquo;{p.transcript}&rdquo;
                    </p>
                  ) : null}

                  {p.grade?.brief_feedback && (
                    <p className="small" style={{ color: 'var(--mute)', marginBottom: 4 }}>{p.grade.brief_feedback}</p>
                  )}

                  {(p.grade?.observed_errors?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {p.grade!.observed_errors.map((err, j) => (
                        <p key={j} className="small" style={{ color: 'var(--mute)', paddingLeft: 12, margin: '1px 0' }}>
                          · <strong>{err.category}</strong>: {err.description}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
