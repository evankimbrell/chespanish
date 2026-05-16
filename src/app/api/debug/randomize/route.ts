import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { QUESTION_BANK } from '@/lib/question-bank';
import type {
  LevelTestSession, PromptResult, TestReport, GradeResult,
  GradeDimensions, SkillScores, Question,
} from '@/lib/types';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

// ── Prompts (same as /api/report/generate) ───────────────────────────────────

const EDUCATOR_PROMPT = `You're an expert language tutor for Spanish, and your student just took a quick brief language test to test their level. You can see all of the questions they were asked and then detailed about what they said and the feedback on what they did right or wrong. From this point, they're going to start taking daily lessons that are audio primarily, but include potential features in the future for vocabulary testing and pronunciation and back-and-forth roleplay.

Imagine you're going to write a report and hand that to another educator who's going to build the first set of lessons and plan the students' trajectory so that they can learn Spanish as quickly and effectively as possible. What would you pull from this report or similar reports that might be useful for the person designing the lessons? What areas do they appear to be weak in? What areas could you immediately address, and what are the knowledge gaps that you might have to fill in before going forward?

Make the report less than 500 words and use bullet points to clearly map their strengths, weaknesses, gaps, and logical things to incorporate next. Make the report specific and to the point.`;

const LESSON_PROMPT = `You're a master Spanish tutor designing the first lesson for a student learning spanish. You've been handed a report explaining the students strengths and weaknesses based off a basic preliminary level test. You'll also receive the level test report that shows the questions they were asked and their answers as well as a grade of how well they did for each question.

Create an audio lesson based off the report recommendations. The target length of the audio lesson is 2000 words.

The lesson should have an English language narrator that briefly explains at the beginning what we'll be doing in the lesson. The English language narrator also will be used in the lesson when the user is instructed to do something. It will also be used an outro saying that the lesson is now over and giving the user some basic encouragement.

IMPORTANT: The audio lesson should use the core tenets of Pimsleur lessons. Pimsleur is built around active recall under light pressure. Instead of passively listening or repeating, the learner is prompted to produce the answer before hearing it. The lesson pauses, the learner responds out loud, then the native speaker gives the correct version. This trains retrieval, pronunciation, and speaking automaticity rather than recognition alone. Its other core mechanic is graduated interval recall: words and phrases return at carefully spaced intervals, just as the learner is starting to forget them. Lessons use a small set of high-value vocabulary and phrase patterns, then recombine them in different ways: statement to question, positive to negative, now to later, "I want" to "do you want." Grammar is learned organically through use, not through long explanations.

Each portion of the lesson needs to be labeled as <English voice> and <Spanish voice>. When the user is expected to respond with an answer, put <prompt>. Use <prompts> frequently to maintain engagement.

Generate the lesson. Do not include any other text other than the lesson transcript. The user does not hear the word <prompt> because this is just a signal for the audio transcriber to read. The English voice should never read Spanish.`;

// ── Fake data pools ───────────────────────────────────────────────────────────

const TRANSCRIPTS_BY_TYPE: Record<string, string[]> = {
  listen_and_respond: [
    'Sí, claro. Estoy bien, gracias.',
    'Bueno, dale. ¿Y vos qué tal?',
    'Eh... bien, creo.',
    'Hola, sí, cómo no.',
    'No sé cómo decirlo... bien, supongo.',
  ],
  say_it_in_spanish: [
    'Quiero un café, por favor.',
    'Necesito ayuda.',
    'Me gustaría hablar con alguien.',
    'Uh... ¿dónde está el baño?',
    'Yo quiero ir al mercado.',
  ],
  listen_for_meaning: [
    'I think she said she wants to go to the store.',
    'He is asking if you want something to drink.',
    'She is saying goodbye and thank you.',
    'Something about the weekend, I think.',
    'They want to meet somewhere.',
  ],
  mini_dialogue_comprehension: [
    'They are planning to meet on Saturday at noon.',
    'She is asking him to call her later tonight.',
    'He wants to know where the restaurant is.',
    'I think one of them is late and apologizing.',
  ],
  monologue_comprehension: [
    'She is talking about her work schedule.',
    'He is describing his neighborhood.',
    'It is about family and weekend plans.',
    'The person is explaining how to get somewhere.',
  ],
  roleplay_response: [
    'Hola, buenos días. Quisiera reservar una mesa.',
    'Perdón, ¿me podés decir cómo llegar al centro?',
    'Sí, necesito ayuda con mi pedido.',
    'Eh, no sé... quiero cambiar mi reserva.',
    'Disculpá, creo que hay un error en la cuenta.',
  ],
  open_speaking: [
    'Bueno, vivo en un barrio tranquilo. Hay muchos árboles y la gente es muy amable.',
    'Me gusta el fin de semana porque puedo descansar y ver a mis amigos.',
    'Trabajo en una oficina. A veces es aburrido pero está bien.',
    'La verdad es que no sé... me gusta mucho la comida argentina.',
  ],
  practical_problem: [
    'Perdón, pero creo que hay un error en mi cuenta.',
    'Necesito cambiar mi reserva. ¿Es posible?',
    'No sé qué hacer. ¿Me podés ayudar?',
    'Sí, el problema es que no funciona.',
  ],
  grammar_in_context: [
    'Yo fui al mercado ayer.',
    'Ella tiene que trabajar mañana.',
    'Nosotros queremos ir al cine.',
    'Vos tenés que estudiar más.',
    'Ellos fueron al parque.',
  ],
};

const FEEDBACK_BY_SCORE: Record<number, string> = {
  0: 'No meaningful response was given.',
  1: 'Attempted but missed the core meaning of the prompt.',
  2: 'Partial response — addressed the question but with notable gaps.',
  3: 'Understood and responded correctly with some errors.',
  4: 'Clear and mostly natural response with minor issues.',
  5: 'Excellent — natural, fluent, and complete.',
};

const ERROR_POOL = [
  { category: 'verb_conjugation', description: 'Incorrect verb form used', severity: 2 as const },
  { category: 'tense_error', description: 'Wrong tense for the context', severity: 2 as const },
  { category: 'target_style_vos', description: 'Used "tú" instead of "vos"', severity: 1 as const },
  { category: 'vocabulary_gap', description: 'Resorted to English for missing vocab', severity: 2 as const },
  { category: 'gender_agreement', description: 'Article/adjective gender mismatch', severity: 1 as const },
  { category: 'word_order', description: 'Non-standard word order', severity: 1 as const },
  { category: 'missing_pronoun', description: 'Omitted required pronoun', severity: 2 as const },
  { category: 'too_much_english', description: 'Switched to English mid-response', severity: 3 as const },
];

const NOTES_POOL = [
  'Shows basic comprehension of simple prompts.',
  'Struggles with vos conjugations.',
  'Good vocabulary range for the level.',
  'Response latency suggests active retrieval, not memorized phrases.',
  'Tense usage is inconsistent.',
  'Pronunciation is intelligible despite some errors.',
  'Uses filler words frequently when searching for vocabulary.',
  'Demonstrated good listening comprehension.',
];

// ── Profiles ─────────────────────────────────────────────────────────────────

const PROFILES = [
  {
    label: 'A2', ability: 3.5, cefr: 'A2', display_level: 'A2',
    scoreRange: [1, 3] as [number, number],
    summary: 'Can handle simple, familiar topics and short exchanges. Grammar is inconsistent and vocabulary is limited.',
    strengths: ['Basic greetings', 'Simple listening comprehension'],
    weaknesses: ['Verb conjugation', 'Argentine vos form', 'Extended speaking'],
  },
  {
    label: 'B1', ability: 5.5, cefr: 'B1', display_level: 'B1',
    scoreRange: [2, 4] as [number, number],
    summary: 'Can handle everyday conversations at a moderate pace. Some grammar gaps remain and spontaneous speech is still effortful.',
    strengths: ['Everyday vocabulary', 'Listening comprehension', 'Basic roleplay'],
    weaknesses: ['Complex tense usage', 'Argentine idioms', 'Extended open speaking'],
  },
  {
    label: 'B2', ability: 7.5, cefr: 'B2', display_level: 'B2',
    scoreRange: [3, 5] as [number, number],
    summary: 'Speaks with confidence and handles most topics well. Complex structures and idiomatic Argentine expressions are the main frontier.',
    strengths: ['Fluent everyday speech', 'Listening comprehension', 'Practical problem solving'],
    weaknesses: ['Advanced idioms', 'C1-level grammar precision', 'Register switching'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fakeDimensions(score: number): GradeDimensions {
  const s = (offset: number) => clamp(score + offset + (Math.random() > 0.5 ? 1 : 0), 0, 5);
  return {
    comprehension: s(0),
    task_completion: score,
    grammar: s(-1),
    vocabulary: s(-1),
    fluency: s(-1),
    pronunciation_intelligibility: s(0),
    response_speed: clamp(3 + randInt(-1, 1), 0, 5),
    target_style_alignment: s(-2),
  };
}

function fakeGrade(question: Question, score: 0 | 1 | 2 | 3 | 4 | 5, transcript: string): GradeResult {
  const LABELS = ['Ouch', 'Bad', 'Ok', 'Good', 'Excellent', 'Excellent'] as const;
  const CEFR_BY_BAND: Record<string, string> = {
    A1: 'A1', A1_PLUS: 'A1', A2_MINUS: 'A2', A2: 'A2', A2_PLUS: 'A2',
    B1_MINUS: 'B1', B1: 'B1', B2_MINUS: 'B2', B2: 'B2', C1_MINUS: 'C1', C1: 'C1',
  };

  const errors = score <= 2
    ? [{ ...pick(ERROR_POOL), review_later: true }]
    : score === 3
      ? (Math.random() > 0.5 ? [{ ...pick(ERROR_POOL), review_later: false }] : [])
      : [];

  return {
    prompt_id: question.prompt_id,
    overall_score: score,
    label: LABELS[score],
    dimension_scores: fakeDimensions(score),
    cefr_signal: CEFR_BY_BAND[question.difficulty_bucket] ?? question.cefr_band,
    observed_errors: errors,
    brief_feedback: FEEDBACK_BY_SCORE[score],
    notes_for_profile: [pick(NOTES_POOL), pick(NOTES_POOL)].filter((v, i, a) => a.indexOf(v) === i),
  };
}

function buildFakeSession(profile: typeof PROFILES[number]): LevelTestSession {
  // Pick 10 questions, varying difficulty bands
  const shuffled = [...QUESTION_BANK].sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, 10);

  const now = new Date().toISOString();
  let abilityEst = profile.ability;

  const prompts: PromptResult[] = questions.map((q, i) => {
    const [sMin, sMax] = profile.scoreRange;
    const rawScore = randInt(sMin, sMax);
    const score = clamp(rawScore, 0, 5) as 0 | 1 | 2 | 3 | 4 | 5;

    const transcriptPool = TRANSCRIPTS_BY_TYPE[q.prompt_type] ?? TRANSCRIPTS_BY_TYPE.listen_and_respond;
    const transcript = pick(transcriptPool);

    const grade = fakeGrade(q, score, transcript);
    const evidenceScore = clamp(q.difficulty_score + ([-2.2, -1.5, -0.7, 0, 0.5, 0.9][score] ?? 0), 0, 10);
    const abilityBefore = abilityEst;
    abilityEst = abilityEst * 0.7 + evidenceScore * 0.3;

    return {
      promptIndex: i,
      questionId: q.prompt_id,
      promptType: q.prompt_type,
      promptDifficulty: q.difficulty_score,
      promptBucket: q.difficulty_bucket,
      promptText: q.audio_text || q.instruction_text,
      transcript,
      usedTranscriptHelp: false,
      skipped: false,
      responseTimeSeconds: parseFloat((Math.random() * 4 + 1.5).toFixed(1)),
      speakingDurationSeconds: parseFloat((Math.random() * 5 + 2).toFixed(1)),
      wordsPerMinute: randInt(80, 160),
      overallScore: score,
      evidenceScore,
      abilityEstimateBefore: abilityBefore,
      abilityEstimateAfter: abilityEst,
      grade,
      briefFeedback: grade.brief_feedback,
    };
  });

  const skillBase = profile.ability;
  const noise = () => clamp(skillBase + (Math.random() * 2 - 1), 0, 10);
  const skillScores: SkillScores = {
    listening_comprehension: noise(),
    speaking_fluency: noise(),
    grammar_control: noise(),
    vocabulary_range: noise(),
    pronunciation_intelligibility: noise(),
    response_speed: noise(),
    target_style_alignment: noise(),
    practical_communication: noise(),
  };

  const report: TestReport = {
    overall_score: abilityEst,
    display_level: profile.display_level,
    cefr_band: profile.cefr,
    confidence: 'medium',
    confidence_range: [abilityEst - 0.8, abilityEst + 0.8],
    summary: profile.summary,
    skill_scores: skillScores,
    strengths: profile.strengths,
    weaknesses: profile.weaknesses,
    most_common_error_categories: ['verb_conjugation', 'target_style_vos', 'vocabulary_gap'],
    next_level_gap: `Student needs more consistent grammar control and exposure to Argentine idioms to advance.`,
    recommended_first_lesson: {
      title: 'Café & Daily Greetings',
      scenario: 'Ordering at a Buenos Aires café',
      focus_points: ['Vos conjugation', 'Basic ordering phrases', 'Polite requests'],
      why: 'High-frequency scenario that builds confidence immediately.',
    },
    next_three_lessons: [
      { title: 'Getting Around', target_difficulty: abilityEst + 0.5, focus: 'Directions and transport' },
      { title: 'Shopping & Bargaining', target_difficulty: abilityEst + 0.8, focus: 'Prices and negotiation' },
      { title: 'Making Plans', target_difficulty: abilityEst + 1.2, focus: 'Future tense and invitations' },
    ],
  };

  return {
    startedAt: now,
    completedAt: now,
    comfortLevel: 3,
    prompts,
    report,
  };
}

function formatSessionForOpenAI(session: LevelTestSession, userName: string): string {
  const report = session.report;
  const prompts = session.prompts;
  const lines: string[] = [
    `LEVEL TEST RESULTS`, `==================`, `Student: ${userName}`,
  ];
  if (report) {
    lines.push(
      `Overall Level: ${report.display_level} (CEFR: ${report.cefr_band})`,
      `Confidence: ${report.confidence} (${report.confidence_range[0].toFixed(1)}–${report.confidence_range[1].toFixed(1)})`,
      `Summary: ${report.summary}`,
    );
  }
  lines.push(`Test date: ${session.completedAt ?? 'unknown'}`, `Prompts completed: ${prompts.length}`, ``);
  if (report?.skill_scores) {
    lines.push(
      `SKILL SCORES (0–10)`, `-------------------`,
      `Listening comprehension: ${report.skill_scores.listening_comprehension.toFixed(1)}`,
      `Speaking fluency: ${report.skill_scores.speaking_fluency.toFixed(1)}`,
      `Grammar control: ${report.skill_scores.grammar_control.toFixed(1)}`,
      `Vocabulary range: ${report.skill_scores.vocabulary_range.toFixed(1)}`,
      `Pronunciation: ${report.skill_scores.pronunciation_intelligibility.toFixed(1)}`,
      `Response speed: ${report.skill_scores.response_speed.toFixed(1)}`,
      `Argentine style alignment: ${report.skill_scores.target_style_alignment.toFixed(1)}`,
      `Practical communication: ${report.skill_scores.practical_communication.toFixed(1)}`, ``,
    );
  }
  if (report?.strengths?.length) lines.push(`Strengths: ${report.strengths.join(', ')}`);
  if (report?.weaknesses?.length) lines.push(`Weaknesses: ${report.weaknesses.join(', ')}`);
  if (report?.next_level_gap) lines.push(`Gap to next level: ${report.next_level_gap}`);
  lines.push(``, `QUESTION-BY-QUESTION BREAKDOWN`, `------------------------------`);
  for (const p of prompts) {
    lines.push(
      `Q${p.promptIndex + 1}: [${p.promptType}] [${p.promptBucket}] difficulty ${p.promptDifficulty.toFixed(1)}`,
      `Prompt: "${p.promptText}"`,
      p.transcript ? `Response: "${p.transcript}"` : `Response: (no transcript)`,
    );
    if (p.grade) {
      lines.push(`Grade: ${p.grade.label} (${p.grade.overall_score}/5) | CEFR signal: ${p.grade.cefr_signal}`);
      if (p.grade.brief_feedback) lines.push(`Feedback: ${p.grade.brief_feedback}`);
      if (p.grade.observed_errors?.length) {
        lines.push(`Errors: ${p.grade.observed_errors.map((e) => `${e.category}: ${e.description}`).join('; ')}`);
      }
      if (p.grade.notes_for_profile?.length) lines.push(`Observations: ${p.grade.notes_for_profile.join(' | ')}`);
    }
    lines.push(`Ability before: ${p.abilityEstimateBefore.toFixed(2)} → after: ${p.abilityEstimateAfter.toFixed(2)}`, ``);
  }
  return lines.join('\n');
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return new Response('OPENAI_API_KEY not configured', { status: 500 });
  }

  try {
  const profile = pick(PROFILES);
  const session = buildFakeSession(profile);
  const userName = `debug-${profile.label.toLowerCase()}`;
  const formattedReport = formatSessionForOpenAI(session, userName);

  const educatorCompletion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    temperature: 0.4,
    max_tokens: 800,
    messages: [{ role: 'user', content: EDUCATOR_PROMPT + '\n\n' + formattedReport }],
  });
  const educatorReport = educatorCompletion.choices[0]?.message?.content ?? '';

  const lessonCompletion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    temperature: 0.5,
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `${LESSON_PROMPT}\n\n--- EDUCATOR RECOMMENDATIONS ---\n${educatorReport}\n\n--- LEVEL TEST REPORT ---\n${formattedReport}`,
    }],
  });
  const lessonTranscript = lessonCompletion.choices[0]?.message?.content ?? '';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${userName}-${timestamp}.json`;
  const reportsDir = path.join(process.cwd(), 'data', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, filename),
    JSON.stringify({ userName, generatedAt: new Date().toISOString(), educatorReport, testReport: session.report, lessonTranscript, session }, null, 2),
  );

  return Response.json({ lessonTranscript, profile: profile.label, savedTo: `data/reports/${filename}` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[debug/randomize] error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
