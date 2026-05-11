'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';
import { QUESTION_BANK } from '@/lib/question-bank';
import type { LevelTestSession, PromptMetric, PromptType } from '@/lib/types';

// ── Level derivation ────────────────────────────────────────────────────────

const CEFR_RANK: Record<string, number> = {
  below_A1: 0, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};
const CEFR_LABELS = ['A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function deriveLevel(prompts: PromptMetric[]): string {
  const ranks = prompts
    .filter((p) => p.grade?.cefr_signal)
    .map((p) => CEFR_RANK[p.grade!.cefr_signal] ?? 2)
    .sort((a, b) => a - b);
  if (!ranks.length) return 'A2';
  return CEFR_LABELS[ranks[Math.floor(ranks.length / 2)]] ?? 'A2';
}

const LEVEL_BLURBS: Record<string, string> = {
  A1: 'You know some key words and can handle very basic exchanges. Focus on building core phrases and getting comfortable with the sound of Argentine Spanish.',
  A2: 'You can handle simple, familiar topics and short exchanges. You understand slow, clear speech but longer phrases still need work.',
  B1: 'You can handle everyday conversations and follow most audio at normal speed. Some grammar gaps remain and spontaneous speech is still effortful.',
  B2: 'You speak with confidence and handle most topics well. Complex structures and idiomatic Argentine expressions are the main frontier.',
  C1: 'You handle the language with ease and sound natural in most situations. Fine-tuning nuance and regional vocabulary is what remains.',
};

const LEVEL_LESSONS: Record<string, { title: string; desc: string }> = {
  A1: { title: 'First words in Buenos Aires.', desc: 'Essential greetings, numbers, and survival phrases with Argentine pronunciation. About 10 minutes of audio.' },
  A2: { title: 'Getting around the city.', desc: 'Directions, transport, and everyday service interactions using vos forms. About 15 minutes of audio.' },
  B1: { title: 'Making plans with a friend.', desc: 'Casual invitations, near-future ("voy a"), and the vos forms you need. About 25 minutes of audio.' },
  B2: { title: 'Navigating work conversations.', desc: 'Professional register, complex opinions, and Argentine workplace culture. About 25 minutes of audio.' },
  C1: { title: 'Advanced Argentine culture & debate.', desc: 'Nuanced argument, regional vocabulary, and fluid register-switching. About 40 minutes of audio.' },
};

// ── Error category → readable label ────────────────────────────────────────

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

// ── Skill target → readable label ──────────────────────────────────────────

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

// ── Prompt type → label ────────────────────────────────────────────────────

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

// ── Grade badge ────────────────────────────────────────────────────────────

const BADGE_COLOR: Record<number, string> = {
  0: 'var(--crit)',
  1: 'var(--crit)',
  2: 'var(--mute)',
  3: 'var(--leaf)',
  4: 'var(--warm)',
  5: 'var(--warm)',
};

function GradeBadge({ score, label }: { score: number; label: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '.06em',
        color: BADGE_COLOR[score] ?? 'var(--mute)',
        background: `color-mix(in srgb, ${BADGE_COLOR[score] ?? 'var(--mute)'} 12%, transparent)`,
        padding: '3px 8px',
        borderRadius: 3,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

// ── Derived insights ───────────────────────────────────────────────────────

const bankById = Object.fromEntries(QUESTION_BANK.map((q) => [q.prompt_id, q]));

function deriveInsights(prompts: PromptMetric[]) {
  const errorCounts: Record<string, number> = {};
  const strongSkills = new Set<string>();

  for (const p of prompts) {
    if (!p.grade) continue;
    for (const e of p.grade.observed_errors) {
      if (e.category in ERROR_LABELS) {
        errorCounts[e.category] = (errorCounts[e.category] ?? 0) + 1;
      }
    }
    if (p.grade.score >= 4) {
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function LevelResultPage() {
  const router = useRouter();
  const storeSession = useAppStore((s) => s.levelTestSession);
  const [localSession, setLocalSession] = useState<LevelTestSession | null>(null);

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
  const level = deriveLevel(prompts);
  const blurb = LEVEL_BLURBS[level] ?? LEVEL_BLURBS.B1;
  const lesson = LEVEL_LESSONS[level] ?? LEVEL_LESSONS.B1;
  const { needsWork, strongWith } = deriveInsights(prompts);

  const displayStrong = strongWith.length ? strongWith : ['Attempted all prompts', 'Engaged with audio'];
  const displayNeeds = needsWork.length ? needsWork : ['Complete a test for detailed feedback'];

  return (
    <>
      <BrandBar label="03 Level result" />
      <div className="page-narrow fade-in">
        <div className="col gap-12">

          {/* Header */}
          <div className="col gap-3">
            <span className="eyebrow">Level test complete · {prompts.length || 12} prompts</span>
            <h1 className="h-display">Your level is <em>{level}.</em></h1>
            <p className="lede" style={{ maxWidth: 560 }}>{blurb}</p>
          </div>

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
                    </span>
                    {p.grade && <GradeBadge score={p.grade.score} label={p.grade.label} />}
                  </div>
                  <p className="serif" style={{ fontSize: 18, fontStyle: 'italic', marginBottom: 6 }}>
                    &ldquo;{p.promptText}&rdquo;
                  </p>
                  {p.transcript && (
                    <p className="body" style={{ color: 'var(--ink-2)', marginBottom: p.grade?.feedback ? 4 : 0 }}>
                      You said: &ldquo;{p.transcript}&rdquo;
                    </p>
                  )}
                  {p.grade?.feedback && (
                    <p className="small" style={{ color: 'var(--mute)', marginTop: 4 }}>{p.grade.feedback}</p>
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
            <p className="body" style={{ maxWidth: 620 }}>{lesson.desc}</p>
            <div className="row gap-3" style={{ marginTop: 24 }}>
              <button className="btn btn-warm" onClick={() => router.push('/preview')}>
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
