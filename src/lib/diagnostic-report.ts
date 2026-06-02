import OpenAI from 'openai';
import { QUESTION_BANK } from '@/lib/question-bank';
import type {
  PromptResult,
  TestReport,
  DiagnosticReport,
  CategoryDiagnostic,
  DiagnosticCategoryId,
  DiagnosticExample,
} from '@/lib/types';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const QUESTION_BY_ID = new Map(QUESTION_BANK.map((q) => [q.prompt_id, q]));

const CATEGORY_IDS: DiagnosticCategoryId[] = [
  'listening_comprehension',
  'practical_communication',
  'grammar_control',
  'vocabulary_range',
  'sentence_flow',
  'response_speed',
  'argentine_spanish_fit',
  'pronunciation',
];

export const CATEGORY_DISPLAY_NAMES: Record<DiagnosticCategoryId, string> = {
  listening_comprehension: 'Listening Comprehension',
  practical_communication: 'Practical Communication',
  grammar_control: 'Grammar Control',
  vocabulary_range: 'Vocabulary Range',
  sentence_flow: 'Sentence Flow',
  response_speed: 'Response Speed',
  argentine_spanish_fit: 'Argentine Spanish Fit',
  pronunciation: 'Pronunciation',
};

// ── Input packaging ────────────────────────────────────────────────────────

interface DiagnosticInput {
  estimatedPlacementLevel: string;
  placementConfidence: string;
  targetDialect: string;
  testMetadata: {
    questionCount: number;
    openEndedResponseCount: number;
    totalSpokenWordCount: number;
    wpmEligibleResponseCount: number;
    pronunciationMeasured: boolean;
  };
  responses: Array<Record<string, unknown>>;
}

const OPEN_ENDED_TYPES = new Set(['open_speaking', 'roleplay_response', 'practical_problem']);

function wordCount(text: string | null | undefined): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export function buildDiagnosticInput(
  prompts: PromptResult[],
  placementLevel: string,
  placementConfidence: string,
): DiagnosticInput {
  const responses = prompts.map((p) => {
    const q = QUESTION_BY_ID.get(p.questionId);
    const words = wordCount(p.transcript);
    return {
      promptId: p.questionId,
      promptLevel: p.promptBucket,
      promptType: p.promptType,
      skillTargets: q?.skill_targets ?? [],
      promptText: p.promptText,
      audioText: q?.audio_text ?? null,
      responseLanguageAllowed: q?.response_language_allowed ?? 'spanish',
      learnerAnswer: p.transcript,
      answerGrade: p.grade
        ? {
            label: p.grade.label,
            score: p.grade.overall_score,
            cefrSignal: p.grade.cefr_signal,
            summary: p.grade.brief_feedback,
            dimensionScores: p.grade.dimension_scores,
            errorTags: (p.grade.observed_errors ?? []).map((e) => e.category),
          }
        : null,
      timing: {
        responseLatencyMs: Math.round(p.responseTimeSeconds * 1000),
        spokenWordCount: words,
        wpm: p.wordsPerMinute,
        wpmEligible: words >= 8 && p.wordsPerMinute != null,
      },
      skipped: p.skipped,
    };
  });

  const totalSpokenWordCount = prompts.reduce((sum, p) => sum + wordCount(p.transcript), 0);

  return {
    estimatedPlacementLevel: placementLevel,
    placementConfidence,
    targetDialect: 'Argentine / Rioplatense Spanish',
    testMetadata: {
      questionCount: prompts.length,
      openEndedResponseCount: prompts.filter((p) => OPEN_ENDED_TYPES.has(p.promptType)).length,
      totalSpokenWordCount,
      wpmEligibleResponseCount: prompts.filter((p) => wordCount(p.transcript) >= 8 && p.wordsPerMinute != null).length,
      pronunciationMeasured: false,
    },
    responses,
  };
}

// ── GPT-5.5 prompts (verbatim from spec) ─────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Spanish language placement evaluator and diagnostic report writer.

Your job is to analyze a short Spanish placement test and produce a learner-facing diagnostic report.

The report must be accurate, cautious, and useful. This was a short placement test, usually 10–15 questions, so you must not overstate certainty. You should distinguish between what was clearly observed, what was weakly suggested, and what was not measured.

The learner is studying Spanish with an emphasis on Argentine / Rioplatense Spanish when relevant.

You will receive:
- the estimated placement level
- the learner's test prompts and answers
- prompt difficulty levels
- prompt skill targets
- answer-level grades and/or observations
- timing data when available
- error tags when available

Your task:
1. Write a clear placement rationale.
2. Explain why the learner received the estimated level.
3. Evaluate each diagnostic category relative to expectations for the estimated level.
4. For each category, provide a concise but specific learner-facing explanation.
5. Include examples from the learner's answers when useful.
6. Assign an evidence strength marker to each category.
7. Assign a lesson priority to each category.
8. Recommend what the first lesson should focus on.

Important rules:
- Do not invent examples.
- Do not claim pronunciation was measured unless phoneme-level pronunciation data is provided.
- Do not treat short or constrained answers as strong evidence of vocabulary range.
- Do not calculate WPM or response speed from answers shorter than 8 words unless explicit timing metadata supports a cautious observation.
- Do not use raw numeric category scores in learner-facing summaries.
- Always evaluate categories relative to the learner's estimated placement level, not relative to native-level Spanish.
- If evidence is limited, say so clearly.
- The tone should be encouraging, precise, and diagnostic.
- The report should make the learner feel that the system noticed specific things about their Spanish.
- Return valid JSON only.`;

function buildUserPrompt(input: DiagnosticInput): string {
  return `Generate a Spanish placement test diagnostic report.

Estimated placement level:
${input.estimatedPlacementLevel}

Placement confidence from algorithm:
${input.placementConfidence}

Target dialect / style:
${input.targetDialect}

Test metadata:
${JSON.stringify(input.testMetadata, null, 2)}

Prompt and answer data (includes grading, timing, and error tags):
${JSON.stringify(input.responses, null, 2)}

Diagnostic categories to evaluate:
1. listening_comprehension
2. practical_communication
3. grammar_control
4. vocabulary_range
5. sentence_flow
6. response_speed
7. argentine_spanish_fit
8. pronunciation

Return a JSON object matching this schema:

{
  "placement": {
    "estimatedLevel": string,
    "confidence": "high" | "medium" | "low",
    "shortSummary": string,
    "detailedRationale": string,
    "evidenceSummary": {
      "strongestPositiveSignals": string[],
      "strongestNegativeSignals": string[],
      "limitingFactors": string[]
    }
  },
  "categories": [
    {
      "categoryId": "listening_comprehension" | "practical_communication" | "grammar_control" | "vocabulary_range" | "sentence_flow" | "response_speed" | "argentine_spanish_fit" | "pronunciation",
      "displayName": string,
      "relativeStatus": "above_expectations" | "on_track" | "slightly_below_expectations" | "below_expectations" | "not_enough_evidence" | "not_measured",
      "evidenceStrength": "strong" | "medium" | "light" | "not_enough" | "not_measured",
      "lessonPriority": "high" | "medium" | "low" | "monitor" | "not_applicable",
      "userFacingSummary": string,
      "observedEvidence": string[],
      "examples": [
        { "promptId": string, "promptText": string, "learnerAnswer": string, "observation": string, "errorTags": string[] }
      ],
      "shouldDisplay": boolean
    }
  ],
  "commonErrors": [
    {
      "tag": string,
      "displayName": string,
      "frequency": number,
      "severity": "low" | "medium" | "high",
      "userFacingExplanation": string,
      "example": { "promptId": string, "promptText": string, "learnerAnswer": string, "observation": string, "errorTags": string[] }
    }
  ],
  "firstLessonRecommendation": {
    "title": string,
    "level": string,
    "focusSummary": string,
    "targetSkills": string[],
    "avoidForNow": string[]
  },
  "reportMetadata": { "reportVersion": "diagnostic-report-v1" }
}

Writing requirements:
- The placement shortSummary should be 1–2 sentences.
- The detailedRationale should be 3–5 sentences.
- Each category userFacingSummary should be 1–2 sentences.
- Include examples only when directly supported by learner answers; quote the learner's actual answer exactly as provided.
- If a category has weak evidence, the summary must explicitly say the signal is limited.
- For pronunciation, always return relativeStatus "not_measured", evidenceStrength "not_measured", lessonPriority "not_applicable".
- Evaluate every category relative to the estimated placement level, not native Spanish.
- Return valid JSON only.`;
}

// ── Validation ───────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

function cleanExamples(examples: unknown, transcripts: string[]): DiagnosticExample[] | undefined {
  if (!Array.isArray(examples)) return undefined;
  const normed = transcripts.map(normalize).filter(Boolean);
  const kept = examples
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      promptId: String(e.promptId ?? ''),
      promptText: typeof e.promptText === 'string' ? e.promptText : undefined,
      learnerAnswer: typeof e.learnerAnswer === 'string' ? e.learnerAnswer : undefined,
      observation: String(e.observation ?? ''),
      errorTags: Array.isArray(e.errorTags) ? e.errorTags.map(String) : undefined,
    }))
    // No invented examples: the quoted answer must match an actual transcript.
    .filter((e) => {
      if (!e.learnerAnswer) return false;
      const a = normalize(e.learnerAnswer);
      return a.length > 0 && normed.some((t) => t === a || t.includes(a) || a.includes(t));
    });
  return kept.length ? kept : undefined;
}

const VALID_STATUS = new Set(['above_expectations', 'on_track', 'slightly_below_expectations', 'below_expectations', 'not_enough_evidence', 'not_measured']);
const VALID_EVIDENCE = new Set(['strong', 'medium', 'light', 'not_enough', 'not_measured']);
const VALID_PRIORITY = new Set(['high', 'medium', 'low', 'monitor', 'not_applicable']);

function validateDiagnosticReport(raw: unknown, transcripts: string[]): DiagnosticReport | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || !r.placement) return null;

  const placement = r.placement as DiagnosticReport['placement'];
  if (!placement.estimatedLevel || !placement.shortSummary) return null;

  const rawCategories = Array.isArray(r.categories) ? (r.categories as Record<string, unknown>[]) : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const c of rawCategories) {
    if (c && typeof c.categoryId === 'string') byId.set(c.categoryId, c);
  }

  const categories: CategoryDiagnostic[] = CATEGORY_IDS.map((id) => {
    const c = byId.get(id);
    // Pronunciation is never measured.
    if (id === 'pronunciation') {
      return {
        categoryId: id,
        displayName: CATEGORY_DISPLAY_NAMES[id],
        relativeStatus: 'not_measured',
        evidenceStrength: 'not_measured',
        lessonPriority: 'not_applicable',
        userFacingSummary:
          (c && typeof c.userFacingSummary === 'string' && c.userFacingSummary) ||
          'This placement test did not evaluate phoneme-level pronunciation, so we are not scoring pronunciation yet. We’ll add this once the system can measure pronunciation directly from speech.',
        observedEvidence: [],
        shouldDisplay: true,
      };
    }
    if (!c) {
      return {
        categoryId: id,
        displayName: CATEGORY_DISPLAY_NAMES[id],
        relativeStatus: 'not_enough_evidence',
        evidenceStrength: 'not_enough',
        lessonPriority: 'monitor',
        userFacingSummary: 'We did not collect enough evidence on this area during the placement test. We’ll measure it as you produce more Spanish in future lessons.',
        observedEvidence: [],
        shouldDisplay: true,
      };
    }
    const status = VALID_STATUS.has(String(c.relativeStatus)) ? (c.relativeStatus as CategoryDiagnostic['relativeStatus']) : 'not_enough_evidence';
    const evidence = VALID_EVIDENCE.has(String(c.evidenceStrength)) ? (c.evidenceStrength as CategoryDiagnostic['evidenceStrength']) : 'not_enough';
    const priority = VALID_PRIORITY.has(String(c.lessonPriority)) ? (c.lessonPriority as CategoryDiagnostic['lessonPriority']) : 'monitor';
    return {
      categoryId: id,
      displayName: CATEGORY_DISPLAY_NAMES[id],
      relativeStatus: status,
      evidenceStrength: evidence,
      lessonPriority: priority,
      userFacingSummary: typeof c.userFacingSummary === 'string' ? c.userFacingSummary : '',
      observedEvidence: Array.isArray(c.observedEvidence) ? c.observedEvidence.map(String) : [],
      examples: cleanExamples(c.examples, transcripts),
      shouldDisplay: c.shouldDisplay !== false,
    };
  });

  const commonErrors = Array.isArray(r.commonErrors)
    ? (r.commonErrors as Record<string, unknown>[])
        .filter((e) => e && typeof e === 'object' && e.tag)
        .map((e) => ({
          tag: String(e.tag),
          displayName: String(e.displayName ?? e.tag),
          frequency: Number(e.frequency) || 0,
          severity: (['low', 'medium', 'high'].includes(String(e.severity)) ? e.severity : 'medium') as 'low' | 'medium' | 'high',
          userFacingExplanation: String(e.userFacingExplanation ?? ''),
          example: e.example ? cleanExamples([e.example], transcripts)?.[0] : undefined,
        }))
    : [];

  const fl = (r.firstLessonRecommendation ?? {}) as Record<string, unknown>;
  const firstLessonRecommendation = {
    title: String(fl.title ?? 'Your first lesson'),
    level: String(fl.level ?? placement.estimatedLevel),
    focusSummary: String(fl.focusSummary ?? ''),
    targetSkills: Array.isArray(fl.targetSkills) ? fl.targetSkills.map(String) : [],
    avoidForNow: Array.isArray(fl.avoidForNow) ? fl.avoidForNow.map(String) : [],
  };

  return {
    placement: {
      estimatedLevel: String(placement.estimatedLevel),
      confidence: (['high', 'medium', 'low'].includes(String(placement.confidence)) ? placement.confidence : 'medium') as 'high' | 'medium' | 'low',
      shortSummary: String(placement.shortSummary),
      detailedRationale: String(placement.detailedRationale ?? ''),
      evidenceSummary: {
        strongestPositiveSignals: Array.isArray(placement.evidenceSummary?.strongestPositiveSignals) ? placement.evidenceSummary.strongestPositiveSignals.map(String) : [],
        strongestNegativeSignals: Array.isArray(placement.evidenceSummary?.strongestNegativeSignals) ? placement.evidenceSummary.strongestNegativeSignals.map(String) : [],
        limitingFactors: Array.isArray(placement.evidenceSummary?.limitingFactors) ? placement.evidenceSummary.limitingFactors.map(String) : [],
      },
    },
    categories,
    commonErrors,
    firstLessonRecommendation,
    reportVersion: 'diagnostic-report-v1',
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateDiagnosticReport(input: DiagnosticInput): Promise<DiagnosticReport | null> {
  const transcripts = input.responses
    .map((r) => (typeof r.learnerAnswer === 'string' ? (r.learnerAnswer as string) : ''))
    .filter(Boolean);
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.5',
      // gpt-5.5 is a reasoning model and this is a large JSON payload (8 categories +
      // examples + common errors). Keep generous headroom so it doesn't truncate.
      max_completion_tokens: 9000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    return validateDiagnosticReport(parsed, transcripts);
  } catch (e) {
    console.error('[diagnostic-report] generation failed:', e);
    return null;
  }
}

// Minimal report from the numeric TestReport, used when GPT generation fails so the
// learner page never breaks.
export function diagnosticFallback(report: TestReport | null): DiagnosticReport {
  const level = report?.display_level ?? 'A2';
  const errorNames: Record<string, string> = {
    ser_estar: 'Ser vs. estar',
    tense_error: 'Tense choice',
    verb_conjugation: 'Verb conjugation',
    gender_agreement: 'Gender agreement',
    too_much_english: 'Switching to English',
  };
  return {
    placement: {
      estimatedLevel: level,
      confidence: report?.confidence ?? 'low',
      shortSummary: report?.summary ?? `You tested at approximately ${level}.`,
      detailedRationale:
        'This is an estimated placement from a short test. Your profile will sharpen as we hear more of your Spanish in upcoming lessons.',
      evidenceSummary: {
        strongestPositiveSignals: report?.strengths ?? [],
        strongestNegativeSignals: report?.weaknesses ?? [],
        limitingFactors: ['This was a short placement test.', 'Pronunciation was not measured at phoneme level.'],
      },
    },
    categories: CATEGORY_IDS.map((id) => ({
      categoryId: id,
      displayName: CATEGORY_DISPLAY_NAMES[id],
      relativeStatus: id === 'pronunciation' ? 'not_measured' : 'not_enough_evidence',
      evidenceStrength: id === 'pronunciation' ? 'not_measured' : 'not_enough',
      lessonPriority: id === 'pronunciation' ? 'not_applicable' : 'monitor',
      userFacingSummary:
        id === 'pronunciation'
          ? 'Pronunciation is not measured yet. We’ll add it once the system can analyze speech directly.'
          : 'We’ll measure this more precisely as you produce more Spanish in future lessons.',
      observedEvidence: [],
      shouldDisplay: true,
    })),
    commonErrors: (report?.most_common_error_categories ?? []).slice(0, 3).map((tag) => ({
      tag,
      displayName: errorNames[tag] ?? tag,
      frequency: 0,
      severity: 'medium' as const,
      userFacingExplanation: `We noticed some recurring issues with ${errorNames[tag] ?? tag}.`,
    })),
    firstLessonRecommendation: {
      title: report?.recommended_first_lesson?.title ?? 'Your first lesson',
      level,
      focusSummary: report?.recommended_first_lesson?.why ?? 'A practical lesson tailored to your level.',
      targetSkills: report?.recommended_first_lesson?.focus_points ?? [],
      avoidForNow: [],
    },
    reportVersion: 'diagnostic-report-v1',
  };
}
