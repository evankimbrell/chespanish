import type {
  Question, TestEngineState, PromptType, ComfortLevel,
  SkillScores, SkillCoverage, PromptResult, TestReport, GradeResult,
} from './types';

// ── Ability scale mapping ──────────────────────────────────────────────────

const COMFORT_TO_ABILITY: Record<number, number> = {
  0: 0.5,  // brand new → skip test (Pre-A1)
  1: 2.2,  // few words → A1
  2: 4.2,  // studied a little → A2
  3: 6.2,  // basic conversations → B1
  4: 8.2,  // pretty comfortable → B2
  5: 9.5,  // advanced → C1
};

// Float 0–10 → display level string
const LEVEL_BANDS: [number, string][] = [
  [0.9,  'Pre-A1'],
  [1.6,  'A1-'],
  [2.2,  'A1'],
  [2.9,  'A1+'],
  [3.6,  'A2-'],
  [4.2,  'A2'],
  [4.9,  'A2+'],
  [5.6,  'B1-'],
  [6.2,  'B1'],
  [6.9,  'B1+'],
  [7.6,  'B2-'],
  [8.2,  'B2'],
  [8.8,  'B2+'],
  [9.3,  'C1-'],
  [9.7,  'C1'],
  [10.0, 'C1+'],
];

export function mapScoreToDisplayLevel(score: number): string {
  for (const [max, label] of LEVEL_BANDS) {
    if (score <= max) return label;
  }
  return 'C1+';
}

function displayLevelToCefr(display: string): string {
  if (display.startsWith('Pre')) return 'Pre-A1';
  if (display.startsWith('A1')) return 'A1';
  if (display.startsWith('A2')) return 'A2';
  if (display.startsWith('B1')) return 'B1';
  if (display.startsWith('B2')) return 'B2';
  return 'C1';
}

// ── Evidence score formula ────────────────────────────────────────────────

const EVIDENCE_OFFSET: Record<number, number> = {
  0: -2.2, 1: -1.5, 2: -0.7, 3: 0.0, 4: 0.5, 5: 0.9,
};

const DIFFICULTY_ADJUSTMENT: Record<number, number> = {
  0: -1.0, 1: -0.8, 2: -0.4, 3: 0.0, 4: 0.3, 5: 0.6,
};

export function calculateEvidenceScore(promptDifficulty: number, overallScore: number): number {
  return Math.max(0, Math.min(10, promptDifficulty + (EVIDENCE_OFFSET[overallScore] ?? 0)));
}

// ── Skill coverage map ────────────────────────────────────────────────────

const PROMPT_TYPE_TO_SKILL: Record<PromptType, keyof SkillCoverage> = {
  listen_and_respond:          'listening',
  listen_for_meaning:          'listening',
  mini_dialogue_comprehension: 'dialogue_monologue',
  monologue_comprehension:     'dialogue_monologue',
  say_it_in_spanish:           'speaking_production',
  grammar_in_context:          'grammar_structured',
  open_speaking:               'open_speaking',
  roleplay_response:           'roleplay_practical',
  practical_problem:           'roleplay_practical',
};

// ── Speed score from words-per-minute ─────────────────────────────────────
// Speed is measured ABSOLUTELY against a native conversational baseline, NOT
// relative to the learner's CEFR level. Native Rioplatense conversational pace
// is ~150 WPM (natural range 130–160). WPM maps linearly onto 0–10 so each
// ~10 WPM ≈ 1 point: 150+ WPM = 10 (native), 50 WPM = 0 (extremely halting).
// Bands: 150→10, 130→8, 110→6 (slightly slow), 90→4 (clearly slow), 70→2.
// This makes an A2 at 150 WPM score higher than a C1 at 140 WPM.
const NATIVE_WPM = 150;
const FLOOR_WPM = 50;
const NEUTRAL_SPEED = 5; // shown until enough speech has been measured

export function wpmToSpeedScore(wpm: number): number {
  return Math.max(0, Math.min(10, ((wpm - FLOOR_WPM) / (NATIVE_WPM - FLOOR_WPM)) * 10));
}

function emptySkillScores(base: number): SkillScores {
  return {
    listening_comprehension: base,
    speaking_fluency: base,
    grammar_control: base,
    vocabulary_range: base,
    // Speed is WPM-measured, not level-seeded — start neutral until measured.
    response_speed: NEUTRAL_SPEED,
    target_style_alignment: base,
    practical_communication: base,
  };
}

function emptySkillCoverage(): SkillCoverage {
  return { listening: 0, speaking_production: 0, open_speaking: 0, roleplay_practical: 0, grammar_structured: 0, dialogue_monologue: 0 };
}

// ── Public API ────────────────────────────────────────────────────────────

export function initEngine(comfortLevel: ComfortLevel | null): TestEngineState {
  const ability = COMFORT_TO_ABILITY[comfortLevel ?? 1] ?? 1.5;
  return {
    abilityEstimate: ability,
    initialAbilityEstimate: ability,
    nextTargetDifficulty: ability,
    skillScores: emptySkillScores(ability),
    askedIds: [],
    recentTypes: [],
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
    promptCount: 0,
    confidence: 'low',
    confidenceRange: [Math.max(0, ability - 1.2), Math.min(10, ability + 1.2)],
    skillCoverage: emptySkillCoverage(),
    lastUsedTranscriptHelp: false,
    lastWasSlow: false,
    lastWasSkipped: false,
  };
}

export function selectNextQuestion(state: TestEngineState, bank: Question[]): Question | null {
  const available = bank.filter((q) => !state.askedIds.includes(q.prompt_id));
  if (available.length === 0) return null;

  const isEarlyCalibration = state.promptCount < 4;
  const window = isEarlyCalibration ? 1.0 : state.confidence === 'high' ? 0.5 : 0.7;
  const recentTypeSet = new Set<PromptType>(state.recentTypes.slice(-3) as PromptType[]);
  const target = state.nextTargetDifficulty;

  // For late test, consider a ceiling probe ~1.0 above estimate
  const wantCeilingProbe = !isEarlyCalibration && state.promptCount >= 8 && state.confidence !== 'high';
  const ceilingTarget = Math.min(10, state.abilityEstimate + 1.0);

  function filterWindow(w: number, ignoreTypes = false): Question[] {
    return available.filter((q) =>
      Math.abs(q.difficulty_score - target) <= w &&
      (ignoreTypes || !recentTypeSet.has(q.prompt_type))
    );
  }

  let candidates = filterWindow(window);
  if (candidates.length < 2) candidates = filterWindow(window + 0.5);
  if (candidates.length < 2) candidates = filterWindow(window + 1.0);
  if (candidates.length === 0) candidates = filterWindow(window, true); // ignore type rotation
  if (candidates.length === 0) candidates = available;

  // Prefer ceiling probe occasionally
  if (wantCeilingProbe && Math.random() < 0.3) {
    const ceilingCandidates = available.filter(
      (q) => Math.abs(q.difficulty_score - ceilingTarget) <= 0.7 && !recentTypeSet.has(q.prompt_type)
    );
    if (ceilingCandidates.length > 0) candidates = ceilingCandidates;
  }

  // Score by under-tested skill coverage
  const scored = candidates.map((q) => {
    const skillKey = PROMPT_TYPE_TO_SKILL[q.prompt_type];
    const coverageScore = (state.skillCoverage[skillKey] ?? 0) +
      q.skill_targets.reduce((sum, s) => sum + (state.skillCoverage[s as keyof SkillCoverage] ?? 0), 0);
    return { q, coverageScore };
  });

  scored.sort((a, b) => a.coverageScore - b.coverageScore);
  const best = scored[0].coverageScore;
  const topTier = scored.filter((s) => s.coverageScore === best).map((s) => s.q);
  return topTier[Math.floor(Math.random() * topTier.length)];
}

export function updateEngine(
  state: TestEngineState,
  overallScore: number,
  promptResult: PromptResult,
  lastQuestion: Question,
): TestEngineState {
  const evidenceScore = calculateEvidenceScore(lastQuestion.difficulty_score, overallScore);

  // EMA ability update
  const newAbility = Math.max(0, Math.min(10, state.abilityEstimate * 0.7 + evidenceScore * 0.3));

  // Consecutive score tracking
  const isHigh = overallScore >= 3;
  const isLow  = overallScore <= 1;
  const newHigh = isHigh ? state.consecutiveHighScores + 1 : 0;
  const newLow  = isLow  ? state.consecutiveLowScores  + 1 : 0;

  // Next difficulty with modifiers
  const responseWasSlow = promptResult.responseTimeSeconds > 7;
  const usedTranscriptHelp = promptResult.usedTranscriptHelp;
  const wasSkipped = promptResult.skipped;
  let deltaDiff = DIFFICULTY_ADJUSTMENT[overallScore] ?? 0;
  if (responseWasSlow)     deltaDiff -= 0.2;
  if (usedTranscriptHelp)  deltaDiff -= 0.3;
  if (wasSkipped)          deltaDiff -= 0.8;
  if (newHigh >= 2)        deltaDiff += 0.3;
  if (newLow >= 2)         deltaDiff -= 0.5;
  const nextTarget = Math.max(0, Math.min(10, lastQuestion.difficulty_score + deltaDiff));

  // Update skill scores via EMA — weight based on prompt type
  const skillKey = PROMPT_TYPE_TO_SKILL[lastQuestion.prompt_type];
  const newSkillScores = { ...state.skillScores };
  const w = lastQuestion.dimension_weighting ?? {};

  // Map dimension_weighting keys to skill score keys.
  // Note: `response_speed` is intentionally NOT here — Speed is measured directly
  // from words-per-minute below, not from the grader's level-influenced dimension.
  // `pronunciation_intelligibility` is omitted because we don't measure pronunciation.
  const dimToSkill: Partial<Record<string, keyof SkillScores>> = {
    comprehension: 'listening_comprehension',
    task_completion: 'practical_communication',
    grammar: 'grammar_control',
    vocabulary: 'vocabulary_range',
    fluency: 'speaking_fluency',
    target_style_alignment: 'target_style_alignment',
  };

  for (const [dim, weight] of Object.entries(w)) {
    const sk = dimToSkill[dim];
    if (sk && weight && weight > 0) {
      const dimScore = promptResult.grade?.dimension_scores?.[dim as keyof typeof promptResult.grade.dimension_scores];
      if (dimScore != null) {
        // Scale dimension score (0-5) to ability scale (0-10) then EMA
        const scaled = (dimScore / 5) * 10;
        newSkillScores[sk] = newSkillScores[sk] * (1 - weight * 0.3) + scaled * (weight * 0.3);
        newSkillScores[sk] = Math.max(0, Math.min(10, newSkillScores[sk]));
      }
    }
  }

  // Speed skill — measured directly from words-per-minute against the native
  // baseline (level-independent), not from the grader. Only update on responses
  // long enough to give a reliable rate; EMA to smooth single-response noise.
  const wpm = promptResult.wordsPerMinute;
  const wordCount = promptResult.transcript ? promptResult.transcript.trim().split(/\s+/).filter(Boolean).length : 0;
  if (wpm != null && wpm > 0 && wordCount >= 4) {
    const speedTarget = wpmToSpeedScore(wpm);
    newSkillScores.response_speed = Math.max(0, Math.min(10,
      newSkillScores.response_speed * 0.5 + speedTarget * 0.5));
  }

  // Update skill coverage
  const newCoverage = { ...state.skillCoverage };
  newCoverage[skillKey] = (newCoverage[skillKey] ?? 0) + 1;

  const newPromptCount = state.promptCount + 1;
  const newConfidence = deriveConfidence(newPromptCount, newHigh, newLow, newCoverage);
  const confidenceRange = deriveConfidenceRange(newAbility, newConfidence);

  return {
    abilityEstimate: newAbility,
    initialAbilityEstimate: state.initialAbilityEstimate,
    nextTargetDifficulty: nextTarget,
    skillScores: newSkillScores,
    askedIds: [...state.askedIds, lastQuestion.prompt_id],
    recentTypes: [...state.recentTypes.slice(-2), lastQuestion.prompt_type],
    consecutiveHighScores: newHigh,
    consecutiveLowScores: newLow,
    promptCount: newPromptCount,
    confidence: newConfidence,
    confidenceRange,
    skillCoverage: newCoverage,
    lastUsedTranscriptHelp: usedTranscriptHelp,
    lastWasSlow: responseWasSlow,
    lastWasSkipped: wasSkipped,
  };
}

function deriveConfidence(
  count: number,
  consecutiveHigh: number,
  consecutiveLow: number,
  coverage: SkillCoverage,
): 'low' | 'medium' | 'high' {
  const minCoverageMet =
    coverage.listening >= 2 &&
    coverage.speaking_production >= 1 &&
    coverage.open_speaking >= 1 &&
    coverage.roleplay_practical >= 1;

  if (count >= 10 && minCoverageMet) return 'high';
  if (count >= 6 && minCoverageMet) return 'medium';
  return 'low';
}

function deriveConfidenceRange(ability: number, confidence: 'low' | 'medium' | 'high'): [number, number] {
  const margin = confidence === 'high' ? 0.4 : confidence === 'medium' ? 0.7 : 1.2;
  return [Math.max(0, ability - margin), Math.min(10, ability + margin)];
}

export function shouldStopTest(state: TestEngineState, results: PromptResult[]): boolean {
  const { promptCount, confidence, skillCoverage } = state;

  if (promptCount >= 15) return true;

  const minCoverageMet =
    skillCoverage.listening >= 2 &&
    skillCoverage.speaking_production >= 1 &&
    skillCoverage.open_speaking >= 1 &&
    skillCoverage.roleplay_practical >= 1;

  if (promptCount >= 10 && confidence !== 'low' && minCoverageMet) return true;
  if (promptCount >= 8 && confidence === 'high') return true;

  // Early stop: all A1/A2 prompts scoring 0-1 → confirmed beginner
  if (promptCount >= 6) {
    const lowScores = results.filter((r) => (r.overallScore ?? 5) <= 1 && r.promptDifficulty <= 3.8);
    if (lowScores.length >= 4) return true;
  }

  return false;
}

// ── Final report generation ───────────────────────────────────────────────

const LEVEL_SUMMARIES: Record<string, string> = {
  'Pre-A1': 'You are at the very beginning. Focus on building a core vocabulary and getting comfortable with Spanish sounds.',
  'A1-':    'You know a handful of words and phrases. Keep building basic vocabulary and listening habits.',
  'A1':     'You can handle very simple exchanges. Keep adding phrases and listening to natural speech.',
  'A1+':    'You have solid beginner foundations and are growing into A2 territory.',
  'A2-':    'You can handle simple familiar topics. Short conversations are within reach with some effort.',
  'A2':     'You can communicate in simple, everyday situations. Some grammar gaps remain.',
  'A2+':    'You are a strong A2 speaker approaching B1. Some B1 tasks are within reach.',
  'B1-':    'You are entering B1 territory. Connected speech is developing but still effortful.',
  'B1':     'You can handle everyday conversations and most practical situations.',
  'B1+':    'You have solid B1 ability and are pushing toward B2. Complex tasks are emerging.',
  'B2-':    'You are entering B2 territory. You speak with confidence on most topics.',
  'B2':     'You handle the language well. Idiomatic Argentine expressions are the main frontier.',
  'B2+':    'You are a strong B2 speaker approaching C1 fluency.',
  'C1-':    'You are near-fluent. Nuance, register, and subtle cultural cues are the next step.',
  'C1':     'You handle the language with ease and sound natural in most situations.',
  'C1+':    'Near-native practical fluency. Fine-tuning regional precision is all that remains.',
};

const NEXT_LEVEL_GAPS: Record<string, string> = {
  'Pre-A1': 'To reach A1, build 200–400 core words and start listening to simple Argentine Spanish.',
  'A1-':    'To reach A1, practise greeting exchanges, numbers, and everyday vocabulary.',
  'A1':     'To reach A2, work on simple sentence construction and basic present-tense verbs.',
  'A1+':    'To reach A2, focus on forming short questions and answers in conversation.',
  'A2-':    'To reach A2, practise everyday scenarios: cafés, transport, simple requests.',
  'A2':     'To reach B1, focus on connected past/future narration and practical problem-solving.',
  'A2+':    'To reach B1, focus on connected past/future narration, practical problem-solving, and faster spontaneous responses.',
  'B1-':    'To reach B1, practise sustaining longer answers and handling unexpected questions.',
  'B1':     'To reach B2, practise extended speaking, explaining opinions with reasons, and handling complications.',
  'B1+':    'To reach B2, focus on complex sentence structures and nuanced opinion expression.',
  'B2-':    'To reach B2, practise summarising, debating, and handling abstract topics.',
  'B2':     'To reach C1, focus on abstract topics, implied meaning, and fluid register-switching.',
  'B2+':    'To reach C1, refine nuance, irony, and culturally-loaded language.',
  'C1-':    'To reach C1, focus on pragmatic precision and cultural subtext.',
  'C1':     'Focus on near-native idiomatic fluency and regional vocabulary depth.',
  'C1+':    'Your practical fluency is excellent. Regional nuance and literary register are left to refine.',
};

const RECOMMENDED_LESSONS: Record<string, TestReport['recommended_first_lesson']> = {
  'Pre-A1': { title: 'First words in Buenos Aires', scenario: 'survival', focus_points: ['numbers 1–20', 'greetings', 'please and thank you'], why: 'Build the very first layer of practical vocabulary.' },
  'A1-':    { title: 'First words in Buenos Aires', scenario: 'survival', focus_points: ['core greetings', 'basic questions', 'polite expressions'], why: 'Strengthen the foundation before moving to conversations.' },
  'A1':     { title: 'Getting around the city', scenario: 'transport', focus_points: ['directions', 'transport vocabulary', 'numbers and prices'], why: 'Practice everyday survival situations.' },
  'A1+':    { title: 'Getting around the city', scenario: 'transport', focus_points: ['simple requests', 'vos recognition', 'basic questions'], why: 'Bridge beginner to A2 with practical scenarios.' },
  'A2-':    { title: 'Café and restaurant order', scenario: 'service', focus_points: ['ordering food and drinks', 'asking for things politely', 'basic preferences'], why: 'High-frequency everyday interactions.' },
  'A2':     { title: 'Making plans with a friend', scenario: 'social', focus_points: ['near future with voy a', 'vos forms: querés, podés, tenés', 'simple invitations'], why: 'Bridge A2 to B1 with casual conversational patterns.' },
  'A2+':    { title: 'Making plans with a friend', scenario: 'social', focus_points: ['near future with voy a', 'vos conjugation', 'casual responses'], why: 'Target the specific patterns needed to reach B1.' },
  'B1-':    { title: 'Talking about yesterday', scenario: 'daily_life', focus_points: ['pretérito perfecto', 'narrating simple past events', 'time expressions'], why: 'Past tense is the key gap at this level.' },
  'B1':     { title: 'Dealing with a problem', scenario: 'practical', focus_points: ['explaining a situation', 'making requests politely', 'conditional phrases'], why: 'Practical problem-solving is the B1→B2 bridge.' },
  'B1+':    { title: 'Talking about opinions', scenario: 'discussion', focus_points: ['expressing and justifying opinions', 'discourse connectors', 'subjunctive basics'], why: 'Opinion expression is central to B2.' },
  'B2-':    { title: 'Explaining a complex situation', scenario: 'professional', focus_points: ['conditional and hypothetical structures', 'formal register', 'extended speaking'], why: 'Complex structures mark the B2 ceiling.' },
  'B2':     { title: 'Argentine culture and current events', scenario: 'culture', focus_points: ['complex vocabulary', 'nuanced opinions', 'idiomatic expressions'], why: 'Cultural fluency and nuance are the C1 frontier.' },
  'B2+':    { title: 'Debate and persuasion', scenario: 'debate', focus_points: ['argumentation', 'rhetorical structures', 'register flexibility'], why: 'Debate skills bridge B2+ to C1.' },
  'C1-':    { title: 'Argentine humour and subtext', scenario: 'culture', focus_points: ['irony', 'implied meaning', 'regional idioms'], why: 'Subtext and humour mark near-native fluency.' },
  'C1':     { title: 'Advanced Argentine culture & debate', scenario: 'advanced', focus_points: ['nuanced argument', 'regional vocabulary', 'fluid register-switching'], why: 'Final-mile refinement toward C1+.' },
  'C1+':    { title: 'Advanced Argentine culture & debate', scenario: 'advanced', focus_points: ['literary register', 'dialectal nuance', 'pragmatic precision'], why: 'Polish the final layer of fluency.' },
};

export function generateFinalReport(state: TestEngineState, results: PromptResult[]): TestReport {
  const displayLevel = mapScoreToDisplayLevel(state.abilityEstimate);
  const cefrBand = displayLevelToCefr(displayLevel);

  // Aggregate errors
  const errorCounts: Record<string, number> = {};
  for (const r of results) {
    for (const e of r.grade?.observed_errors ?? []) {
      errorCounts[e.category] = (errorCounts[e.category] ?? 0) + 1;
    }
  }
  const topErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  // Strengths = skills above ability estimate
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const SKILL_DISPLAY: Record<keyof SkillScores, string> = {
    listening_comprehension: 'Listening comprehension',
    speaking_fluency: 'Speaking fluency',
    grammar_control: 'Grammar control',
    vocabulary_range: 'Vocabulary range',
    response_speed: 'Response speed',
    target_style_alignment: 'Argentine style alignment',
    practical_communication: 'Practical communication',
  };
  for (const [key, label] of Object.entries(SKILL_DISPLAY) as [keyof SkillScores, string][]) {
    const score = state.skillScores[key];
    if (score > state.abilityEstimate + 0.3) strengths.push(label);
    if (score < state.abilityEstimate - 0.5) weaknesses.push(label);
  }

  const summary = LEVEL_SUMMARIES[displayLevel] ?? `You tested at approximately ${displayLevel} level.`;
  const nextLevelGap = NEXT_LEVEL_GAPS[displayLevel] ?? '';
  const lesson = RECOMMENDED_LESSONS[displayLevel] ?? RECOMMENDED_LESSONS['A2'];

  // Simple next-three based on level
  const nextThree: TestReport['next_three_lessons'] = [
    { title: lesson.title, target_difficulty: state.nextTargetDifficulty, focus: lesson.focus_points[0] ?? '' },
    { title: 'Expand vocabulary in context', target_difficulty: state.nextTargetDifficulty + 0.3, focus: 'vocabulary and natural phrasing' },
    { title: 'Listening at natural speed', target_difficulty: state.nextTargetDifficulty + 0.5, focus: 'comprehension at full pace' },
  ];

  return {
    overall_score: state.abilityEstimate,
    display_level: displayLevel,
    cefr_band: cefrBand,
    confidence: state.confidence,
    confidence_range: state.confidenceRange,
    summary,
    skill_scores: state.skillScores,
    strengths: strengths.length ? strengths : ['Attempted all prompts'],
    weaknesses: weaknesses.length ? weaknesses : [],
    most_common_error_categories: topErrors,
    next_level_gap: nextLevelGap,
    recommended_first_lesson: lesson,
    next_three_lessons: nextThree,
  };
}
