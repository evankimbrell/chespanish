'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';
import { QUESTION_BANK } from '@/lib/question-bank';
import type { LevelTestSession, PromptResult, PromptType, TestReport } from '@/lib/types';

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

// ── Error / skill labels ──────────────────────────────────────────────────────

const ERROR_LABELS: Record<string, string> = {
  verb_conjugation: 'Verb conjugation',
  tense_error: 'Tense selection',
  target_style_vos: 'Vos forms (tenés / querés)',
  target_style_vocabulary: 'Argentine vocabulary',
  grammar: 'Grammar accuracy',
  word_order: 'Word order',
  object_pronoun: 'Object pronouns',
  missing_pronoun: 'Missing pronouns',
  preposition: 'Prepositions',
  gender_agreement: 'Gender agreement',
  number_agreement: 'Number agreement',
  vocabulary_gap: 'Vocabulary gaps',
  response_speed: 'Response speed',
  incomplete_answer: 'Incomplete answers',
  unnatural_wording: 'Unnatural phrasing',
  too_much_english: 'Switching to English',
  pronunciation: 'Pronunciation',
  ser_estar: 'Ser vs estar',
  por_para: 'Por vs para',
};

const SKILL_LABELS: Record<string, string> = {
  greetings: 'Greetings and introductions',
  basic_listening: 'Listening comprehension',
  basic_response: 'Short responses',
  vos: 'Vos conjugation',
  vos_recognition: 'Understanding vos forms',
  near_future: 'Near future (voy a)',
  past_tense: 'Past tense (pretérito)',
  preterite: 'Past tense (pretérito)',
  food_drink: 'Food and drink vocabulary',
  directions: 'Directions and locations',
  restaurant: 'Restaurant interactions',
  service_interaction: 'Service interactions',
  daily_life: 'Everyday conversation',
  personal_info: 'Personal information',
  opinion: 'Expressing opinions',
  listening: 'Audio comprehension',
  natural_speed: 'Natural-speed audio',
  dialogue_comprehension: 'Dialogue comprehension',
  subjunctive: 'Subjunctive mood',
  conditional: 'Conditional structures',
  extended_speaking: 'Extended speaking',
  problem_explanation: 'Explaining problems',
  formal_register: 'Formal register',
};

const SKILL_SCORE_LABELS: Record<string, string> = {
  listening_comprehension: 'Listening',
  speaking_fluency: 'Fluency',
  grammar_control: 'Grammar',
  vocabulary_range: 'Vocabulary',
  pronunciation_intelligibility: 'Pronunciation',
  response_speed: 'Speed',
  target_style_alignment: 'Argentine style',
  practical_communication: 'Communication',
};

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

// ── Derived insights (fallback when no TestReport) ────────────────────────────

const bankById = Object.fromEntries(QUESTION_BANK.map((q) => [q.prompt_id, q]));

function deriveInsights(prompts: PromptResult[]) {
  const errorCounts: Record<string, number> = {};
  const strongSkills = new Set<string>();

  for (const p of prompts) {
    if (!p.grade) continue;
    for (const e of p.grade.observed_errors) {
      if (e.category in ERROR_LABELS) {
        errorCounts[e.category] = (errorCounts[e.category] ?? 0) + 1;
      }
    }
    if ((p.grade.overall_score ?? 0) >= 4) {
      const q = bankById[p.questionId];
      if (q) {
        for (const s of q.skill_targets) {
          if (s in SKILL_LABELS) strongSkills.add(s);
        }
      }
    }
  }

  const needsWork = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat]) => ERROR_LABELS[cat]);

  const strongWith = [...strongSkills].slice(0, 4).map((s) => SKILL_LABELS[s]);
  return { needsWork, strongWith };
}

// ── Skill scores bar ─────────────────────────────────────────────────────────

function SkillBar({ label, score }: { label: string; score: number }) {
  const pct = Math.round((score / 10) * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="row between">
        <span className="small" style={{ color: 'var(--ink-2)' }}>{label}</span>
        <span className="mono small" style={{ color: 'var(--mute)' }}>{score.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2 }}>
        <div style={{ height: 4, width: `${pct}%`, background: 'var(--warm)', borderRadius: 2 }} />
      </div>
    </div>
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
  const [localSession, setLocalSession] = useState<LevelTestSession | null>(null);
  const [reportSaved, setReportSaved] = useState(false);

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

  useEffect(() => {
    if (!session?.completedAt || reportSaved) return;
    setReportSaved(true);
    fetch('/api/report/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, userName: profile.name }),
    })
      .then((r) => r.json())
      .then((data) => {
        // Update profile level from the test result
        const newLevel = data.testReport?.display_level ?? data.testReport?.cefr_band;
        if (newLevel) setProfile({ level: newLevel });

        if (data.lessonTranscript) {
          setGeneratedLesson({
            transcript: data.lessonTranscript,
            plays: [],
            generatedAt: new Date().toISOString(),
            title: data.testReport?.recommended_first_lesson?.title ?? 'Your first lesson',
          });
        }
      })
      .catch(() => {});
  }, [session, reportSaved, profile.name]);
  const report: TestReport | null = session?.report ?? null;

  // Derived display values
  const displayLevel = report?.display_level ?? deriveLevel(prompts);
  const blurb = report?.summary ?? (LEVEL_BLURBS[displayLevel] ?? LEVEL_BLURBS['A2']);
  const cefrBand = report?.cefr_band ?? displayLevel.replace(/[-+]/g, '').replace('Pre-A1', 'A1');
  const lesson = report?.recommended_first_lesson
    ? { title: report.recommended_first_lesson.title, desc: report.recommended_first_lesson.why }
    : staticLesson(displayLevel);

  const { needsWork: derivedNeeds, strongWith: derivedStrong } = deriveInsights(prompts);
  const strongWith = report?.strengths?.length ? report.strengths : derivedStrong;
  const needsWork = report?.weaknesses?.length
    ? report.weaknesses
    : derivedNeeds;

  const displayStrong = strongWith.length ? strongWith : ['Attempted all prompts', 'Engaged with audio'];
  const displayNeeds = needsWork.length ? needsWork : ['Complete more prompts for detailed feedback'];

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
            {report && (
              <div className="row gap-2" style={{ alignItems: 'center', marginTop: 4 }}>
                <span className="mono small" style={{ color: 'var(--mute)' }}>Confidence:</span>
                <span className="mono small" style={{ color: CONFIDENCE_COLOR[report.confidence] ?? 'var(--mute)', fontWeight: 600 }}>
                  {report.confidence}
                </span>
                <span className="mono small" style={{ color: 'var(--mute-2)' }}>
                  ({report.confidence_range[0].toFixed(1)}–{report.confidence_range[1].toFixed(1)})
                </span>
              </div>
            )}
          </div>

          {/* Skill scores (only if report available) */}
          {report?.skill_scores && (
            <div style={{ border: '1px solid var(--line)', padding: '24px 28px' }}>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 16 }}>Skill scores</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
                {Object.entries(report.skill_scores).map(([key, score]) => (
                  <SkillBar
                    key={key}
                    label={SKILL_SCORE_LABELS[key] ?? key}
                    score={score as number}
                  />
                ))}
              </div>
              {report.next_level_gap && (
                <p className="small" style={{ color: 'var(--mute)', marginTop: 16 }}>{report.next_level_gap}</p>
              )}
            </div>
          )}

          {/* Strong / Needs work */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--line)' }}>
            {[
              { eb: 'Strong with', items: displayStrong, warm: false },
              { eb: 'Needs work',  items: displayNeeds,  warm: true  },
            ].map((col, i) => (
              <div key={i} style={{ padding: '28px 28px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
                <span className={'eyebrow' + (col.warm ? ' eyebrow-warm' : '')}>{col.eb}</span>
                <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
                  {col.items.map((item, j) => (
                    <li key={j} className="row gap-3" style={{ padding: '10px 0', borderTop: j ? '1px solid var(--line)' : 'none', alignItems: 'baseline' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)', width: 24 }}>{String(j + 1).padStart(2, '0')}</span>
                      <span className="serif" style={{ fontSize: 18, color: col.warm ? 'var(--ink)' : 'var(--ink-2)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

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
