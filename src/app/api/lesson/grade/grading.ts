// Pure, side-effect-free grading helpers, extracted from the route so they can be
// unit-tested without importing the OpenAI SDK or a Next request context.

export const VALID_LABELS = ['Excellent', 'Good', 'Ok', 'Almost', 'Ouch'];

export interface NormalizedGrade {
  label: string;
  brief_feedback: string;
  observed_errors: { category: string; description: string }[];
  correct_answer?: string;
  suggested_answer?: string;
}

// Always return a valid LessonGrade shape so the player never shows a blank
// feedback card or hangs on "Grading…", even if the model output is malformed.
export function normalizeGrade(raw: unknown): NormalizedGrade {
  const r = (raw ?? {}) as Record<string, unknown>;
  const label = typeof r.label === 'string' && VALID_LABELS.includes(r.label) ? r.label : 'Ok';
  const brief_feedback = typeof r.brief_feedback === 'string' ? r.brief_feedback : '';
  const observed_errors = Array.isArray(r.observed_errors)
    ? r.observed_errors
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e) => ({ category: String(e.category ?? 'note'), description: String(e.description ?? '') }))
    : [];
  const out: NormalizedGrade = { label, brief_feedback, observed_errors };
  if (typeof r.correct_answer === 'string' && r.correct_answer.trim()) {
    out.correct_answer = r.correct_answer.trim();
  }
  if (typeof r.suggested_answer === 'string' && r.suggested_answer.trim()) {
    out.suggested_answer = r.suggested_answer;
  }
  return out;
}

export interface GradePromptInput {
  modelAnswer: string;
  altAnswer?: string;   // next play's Spanish — the real answer for "respond to a posed question" steps
  transcript: string;
  prevText?: string;
  playText: string;
  nextText?: string;
}

// Build the grader's user message. Neighbouring context (prev/next/alt) is included
// only when present, so the grader can distinguish "answer the posed question" from
// "repeat this phrase" without being fed empty fields.
export function buildGradeUserMessage(input: GradePromptInput): string {
  const { modelAnswer, altAnswer, transcript, prevText, playText, nextText } = input;
  return (
    `model_answer: "${modelAnswer}"\n` +
    (altAnswer ? `alt_model_answer: "${altAnswer}"\n` : '') +
    `learner_said: "${transcript}"\n` +
    (prevText ? `context_before: "${prevText}"\n` : '') +
    `this_step: "${playText}"\n` +
    (nextText ? `context_after: "${nextText}"` : '')
  );
}
