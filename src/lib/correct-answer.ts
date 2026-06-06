// Determine the correct Spanish answer for ONE lesson step. Used by "Hear correct
// version" when the grader didn't return a correct_answer (e.g. grading failed) — the
// baked play.spanishText is a generation-time heuristic that can point at a nearby/
// previous step, so we re-derive from the step's own instruction + surrounding context.
// Pure helpers here so the prompt-shaping and source-selection are unit-testable.

export interface GradeLike {
  correct_answer?: string;
  suggested_answer?: string;
}

// The answer the grader already determined for THIS step (best source when available).
export function gradeProvidedAnswer(grade: GradeLike | null | undefined): string | null {
  const t = grade?.correct_answer ?? grade?.suggested_answer;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

export const CORRECT_ANSWER_SYSTEM = `You determine the single correct Argentine Spanish (Rioplatense) phrase a learner was supposed to SAY for ONE lesson step. Return it so it can be spoken back to them.

Read the step and its surrounding context, decide what the learner was asked to PRODUCE in THIS step, and return that exact Spanish phrase:
- If the step asked them to ANSWER a posed question, return a correct ANSWER (not the question).
- If it asked them to ASK or SAY a question, return that question.
- "model_answer" is only a hint and may be wrong or pulled from a nearby/previous step — trust "this_step" and the surrounding context over it. "alt_model_answer" (the Spanish modeled in the next step) is often the real answer for an "answer the question" step.

Return ONLY JSON: {"answer": "<the correct Spanish phrase, in Spanish>"}`;

export interface CorrectAnswerInput {
  modelAnswer?: string; // baked spanishText hint (may be wrong)
  altAnswer?: string;   // next step's Spanish
  prevText?: string;
  playText: string;
  nextText?: string;
  sectionName?: string;
}

export function buildCorrectAnswerMessage(input: CorrectAnswerInput): string {
  const { modelAnswer, altAnswer, prevText, playText, nextText, sectionName } = input;
  return (
    (sectionName ? `section_name: "${sectionName}"\n` : '') +
    (modelAnswer ? `model_answer (hint, may be wrong): "${modelAnswer}"\n` : '') +
    (altAnswer ? `alt_model_answer: "${altAnswer}"\n` : '') +
    (prevText ? `context_before: "${prevText}"\n` : '') +
    `this_step: "${playText}"\n` +
    (nextText ? `context_after: "${nextText}"` : '')
  );
}
