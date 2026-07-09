'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';
import { DiagnosticReportView } from '@/components/report/diagnostic-report-view';
import type { DiagnosticReport, LevelTestSession, PromptResult, PromptType, TestReport } from '@/lib/types';

// ── Fallback level derivation (when report is null) ───────────────────────────

const CEFR_RANK: Record<string, number> = {
  below_A1: 0, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};
const CEFR_LABELS = ['A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function deriveLevel(prompts: PromptResult[]): string {
  const ranks = prompts
    .filter((p) => p.grade?.cefr_signal)
    .map((p) => CEFR_RANK[p.grade!.cefr_signal] ?? 2)
    .sort((a, b) => a - b);
  if (!ranks.length) return 'A2';
  return CEFR_LABELS[ranks[Math.floor(ranks.length / 2)]] ?? 'A2';
}

// ── Static content ────────────────────────────────────────────────────────────

const LEVEL_BLURBS: Record<string, string> = {
  'Pre-A1': 'You are at the very beginning. Focus on building core vocabulary and getting comfortable with Spanish sounds.',
  'A1-':  'You know a handful of words and phrases. Keep building basic vocabulary and listening habits.',
  'A1':   'You can handle very simple exchanges. Keep adding phrases and listening to natural speech.',
  'A1+':  'You have solid beginner foundations and are growing into A2 territory.',
  'A2-':  'You can handle simple familiar topics. Short conversations are within reach with some effort.',
  'A2':   'You can communicate in simple, everyday situations. Some grammar gaps remain.',
  'A2+':  'You are a strong A2 speaker approaching B1. Some B1 tasks are within reach.',
  'B1-':  'You are entering B1 territory. Connected speech is developing but still effortful.',
  'B1':   'You can handle everyday conversations and most practical situations.',
  'B1+':  'You have solid B1 ability and are pushing toward B2. Complex tasks are emerging.',
  'B2-':  'You are entering B2 territory. You speak with confidence on most topics.',
  'B2':   'You handle the language well. Idiomatic Argentine expressions are the main frontier.',
  'B2+':  'You are a strong B2 speaker approaching C1 fluency.',
  'C1-':  'You are near-fluent. Nuance, register, and subtle cultural cues are the next step.',
  'C1':   'You handle the language with ease and sound natural in most situations.',
  'C1+':  'Near-native practical fluency. Fine-tuning regional precision is all that remains.',
};

const STATIC_LESSONS: Record<string, { title: string; desc: string }> = {
  A1: { title: 'First words in Buenos Aires.', desc: 'Essential greetings, numbers, and survival phrases with Argentine pronunciation. About 10 minutes of audio.' },
  A2: { title: 'Getting around the city.', desc: 'Directions, transport, and everyday service interactions using vos forms. About 15 minutes of audio.' },
  B1: { title: 'Making plans with a friend.', desc: 'Casual invitations, near-future ("voy a"), and the vos forms you need. About 25 minutes of audio.' },
  B2: { title: 'Navigating work conversations.', desc: 'Professional register, complex opinions, and Argentine workplace culture. About 25 minutes of audio.' },
  C1: { title: 'Advanced Argentine culture & debate.', desc: 'Nuanced argument, regional vocabulary, and fluid register-switching. About 40 minutes of audio.' },
};

function staticLesson(level: string) {
  const cefr = level.replace(/[-+]/g, '').replace('Pre-A1', 'A1');
  return STATIC_LESSONS[cefr] ?? STATIC_LESSONS['B1'];
}

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

// ── Grade badge ───────────────────────────────────────────────────────────────

const BADGE_COLOR: Record<number, string> = {
  0: 'var(--crit)', 1: 'var(--crit)', 2: 'var(--mute)',
  3: 'var(--leaf)', 4: 'var(--warm)', 5: 'var(--warm)',
};

function GradeBadge({ score, label }: { score: number; label: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
        color: BADGE_COLOR[score] ?? 'var(--mute)',
        background: `color-mix(in srgb, ${BADGE_COLOR[score] ?? 'var(--mute)'} 12%, transparent)`,
        padding: '3px 8px', borderRadius: 3, textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

// ── Confidence indicator ──────────────────────────────────────────────────────

const CONFIDENCE_COLOR: Record<string, string> = {
  low: 'var(--mute)', medium: 'var(--leaf)', high: 'var(--warm)',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LevelResultPage() {
  const router = useRouter();
  const storeSession = useAppStore((s) => s.levelTestSession);
  const profile = useAppStore((s) => s.profile);
  const setGeneratedLesson = useAppStore((s) => s.setGeneratedLesson);
  const setProfile = useAppStore((s) => s.setProfile);
  const completeLevelTestSession = useAppStore((s) => s.completeLevelTestSession);
  const setDiagnosticReport = useAppStore((s) => s.setDiagnosticReport);
  const [localSession, setLocalSession] = useState<LevelTestSession | null>(null);
  const [reportSaved, setReportSaved] = useState(false);
  const [fetchedDiag, setFetchedDiag] = useState<DiagnosticReport | null>(null);
  // Stream died (deploys sever in-flight streams; networks drop) — offer a retry
  // instead of spinning forever.
  const [diagFailed, setDiagFailed] = useState(false);

  useEffect(() => {
    if (!storeSession) {
      try {
        const raw = localStorage.getItem('che_spanish_level_test');
        if (raw) setLocalSession(JSON.parse(raw) as LevelTestSession);
      } catch {}
    }
  }, [storeSession]);

  const session = storeSession ?? localSession;
  const prompts = session?.prompts ?? [];
  // Prefer a freshly-generated report; fall back to one persisted on the session.
  const diag = fetchedDiag ?? session?.diagnosticReport ?? null;

  useEffect(() => {
    if (!session?.completedAt || reportSaved) return;
    setReportSaved(true);

    // The report is streamed (NDJSON): the diagnostic arrives well before the slow
    // lesson transcript, so we show it the moment it lands instead of waiting for the
    // whole chain. A watchdog aborts if the diagnostic hasn't landed in 3 minutes
    // (normal arrival is well under 1) so a severed stream surfaces a retry.
    setDiagFailed(false);
    let gotDiag = false;
    const ac = new AbortController();
    const watchdog = setTimeout(() => { if (!gotDiag) ac.abort(); }, 180_000);
    (async () => {
      try {
        const res = await fetch('/api/report/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session, userName: profile.name }),
          signal: ac.signal,
        });
        if (!res.body) { setDiagFailed(true); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop()!;
          for (const line of lines) {
            if (!line.trim()) continue;
            let msg: Record<string, unknown>;
            try { msg = JSON.parse(line); } catch { continue; }
            if (msg.type === 'test') {
              const tr = msg.testReport as { display_level?: string; cefr_band?: string } | null;
              const newLevel = tr?.display_level ?? tr?.cefr_band;
              if (newLevel) setProfile({ level: newLevel });
            } else if (msg.type === 'diagnostic') {
              if (msg.diagnosticReport) {
                gotDiag = true;
                setFetchedDiag(msg.diagnosticReport as DiagnosticReport);
                setDiagnosticReport(msg.diagnosticReport as DiagnosticReport);
              }
            } else if (msg.type === 'error') {
              console.error('[level-result] report generation error:', msg.message);
            } else if (msg.type === 'done') {
              if (msg.lessonTranscript) {
                setGeneratedLesson({
                  transcript: msg.lessonTranscript as string,
                  plays: [],
                  generatedAt: new Date().toISOString(),
                  title: (msg.recommendedLesson as { title?: string } | null)?.title
                    ?? session?.report?.recommended_first_lesson?.title ?? 'Your first lesson',
                });
              }
              if (msg.recommendedLesson && session?.report) {
                completeLevelTestSession({ ...session.report, recommended_first_lesson: msg.recommendedLesson as TestReport['recommended_first_lesson'] });
              }
            }
          }
        }
        // Stream ended without ever delivering a diagnostic — treat as failed.
        if (!gotDiag) setDiagFailed(true);
      } catch {
        if (!gotDiag) setDiagFailed(true);
      } finally {
        clearTimeout(watchdog);
      }
    })();
  }, [session, reportSaved, profile.name]);

  // Spinner shows once generation has been kicked off until the report arrives.
  const diagPending = reportSaved && !diag && !diagFailed;
  const report: TestReport | null = session?.report ?? null;

  // Derived display values
  const displayLevel = diag?.placement.estimatedLevel ?? report?.display_level ?? deriveLevel(prompts);
  const blurb = diag?.placement.shortSummary ?? report?.summary ?? (LEVEL_BLURBS[displayLevel] ?? LEVEL_BLURBS['A2']);
  const confidence = diag?.placement.confidence ?? report?.confidence ?? null;
  const lesson = report?.recommended_first_lesson
    ? { title: report.recommended_first_lesson.title, desc: report.recommended_first_lesson.why }
    : staticLesson(displayLevel);

  return (
    <>
      <BrandBar label="03 Level result" />
      <div className="page-narrow fade-in">
        <div className="col gap-12">

          {/* Header */}
          <div className="col gap-3">
            <span className="eyebrow">Level test complete · {prompts.length || 0} prompts</span>
            <h1 className="h-display">Your level is <em>{displayLevel}.</em></h1>
            <p className="lede" style={{ maxWidth: 560 }}>{blurb}</p>
            {confidence && (
              <div className="row gap-2" style={{ alignItems: 'center', marginTop: 4 }}>
                <span className="mono small" style={{ color: 'var(--mute)' }}>Placement confidence:</span>
                <span className="mono small" style={{ color: CONFIDENCE_COLOR[confidence] ?? 'var(--mute)', fontWeight: 600, textTransform: 'capitalize' }}>
                  {confidence}
                </span>
              </div>
            )}
          </div>

          {/* Verbal diagnostic report (replaces numeric skill scores) */}
          {diag ? (
            <DiagnosticReportView report={diag} showPlacementHeader={false} />
          ) : diagPending ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '28px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span className="small" style={{ color: 'var(--mute)' }}>Analyzing your responses and writing your diagnostic report…</span>
            </div>
          ) : diagFailed ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '28px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span className="small" style={{ color: 'var(--mute)', flex: 1, minWidth: 240 }}>
                The connection dropped while writing your diagnostic report. Your test results are safe — try again.
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => setReportSaved(false)}>
                Retry report
              </button>
            </div>
          ) : null}

          {/* Per-prompt responses */}
          {prompts.length > 0 && (
            <div style={{ border: '1px solid var(--line)' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)' }}>
                <span className="eyebrow">Your responses</span>
              </div>
              {prompts.map((p, i) => (
                <div key={i} style={{ padding: '20px 24px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
                    <span className="mono small" style={{ color: 'var(--mute)' }}>
                      {String(i + 1).padStart(2, '0')} · {TYPE_LABEL[p.promptType] ?? p.promptType}
                      {p.promptBucket && <span style={{ color: 'var(--mute-2)', marginLeft: 8 }}>· {p.promptBucket}</span>}
                    </span>
                    {p.grade && <GradeBadge score={p.grade.overall_score} label={p.grade.label} />}
                  </div>
                  <p className="serif" style={{ fontSize: 18, fontStyle: 'italic', marginBottom: 6 }}>
                    &ldquo;{p.promptText}&rdquo;
                  </p>
                  {p.transcript && (
                    <p className="body" style={{ color: 'var(--ink-2)', marginBottom: p.briefFeedback ? 4 : 0 }}>
                      You said: &ldquo;{p.transcript}&rdquo;
                    </p>
                  )}
                  {!p.transcript && p.skipped && (
                    <p className="body" style={{ color: 'var(--mute)', marginBottom: p.briefFeedback ? 4 : 0 }}>
                      Skipped
                    </p>
                  )}
                  {p.briefFeedback && (
                    <p className="small" style={{ color: 'var(--mute)', marginTop: 4 }}>{p.briefFeedback}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recommended lesson */}
          <div className="card" style={{ padding: 32 }}>
            <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
              <span className="eyebrow eyebrow-warm">Recommended first lesson</span>
              <Tag kind="warm">Personalized</Tag>
            </div>
            <h2 className="ty-h2" style={{ marginBottom: 10 }}>{lesson.title}</h2>
            {report?.recommended_first_lesson?.focus_points?.length && (
              <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
                {report.recommended_first_lesson.focus_points.map((fp, i) => (
                  <li key={i} className="row gap-2" style={{ alignItems: 'baseline', padding: '3px 0' }}>
                    <span style={{ color: 'var(--warm)', flexShrink: 0 }}>·</span>
                    <span className="small" style={{ color: 'var(--ink-2)' }}>{fp}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="body" style={{ maxWidth: 620 }}>{lesson.desc}</p>
            {report?.next_three_lessons?.length && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 4 }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 8, fontSize: 10 }}>Up next</span>
                <div className="col gap-2">
                  {report.next_three_lessons.slice(1).map((l, i) => (
                    <span key={i} className="small" style={{ color: 'var(--mute)' }}>
                      {String(i + 2).padStart(2, '0')}. {l.title} — {l.focus}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="row gap-3" style={{ marginTop: 24 }}>
              <button className="btn btn-warm" onClick={() => router.push('/lesson')}>
                Start recommended lesson <Icons.arrow />
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>Go to dashboard</button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
