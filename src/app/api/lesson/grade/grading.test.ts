import { describe, it, expect } from 'vitest';
import { normalizeGrade, buildGradeUserMessage } from './grading';

describe('buildGradeUserMessage', () => {
  it('always includes model_answer, learner_said and this_step', () => {
    const msg = buildGradeUserMessage({
      modelAnswer: 'Hola',
      transcript: 'Hola',
      playText: 'Say hello.',
    });
    expect(msg).toContain('model_answer: "Hola"');
    expect(msg).toContain('learner_said: "Hola"');
    expect(msg).toContain('this_step: "Say hello."');
  });

  it('omits optional context lines when they are absent', () => {
    const msg = buildGradeUserMessage({
      modelAnswer: 'Hola',
      transcript: 'Hola',
      playText: 'Say hello.',
    });
    expect(msg).not.toContain('alt_model_answer');
    expect(msg).not.toContain('context_before');
    expect(msg).not.toContain('context_after');
  });

  it('includes each optional field only when provided', () => {
    const msg = buildGradeUserMessage({
      modelAnswer: 'm',
      altAnswer: 'a',
      transcript: 't',
      prevText: 'p',
      playText: 's',
      nextText: 'n',
    });
    expect(msg).toContain('alt_model_answer: "a"');
    expect(msg).toContain('context_before: "p"');
    expect(msg).toContain('context_after: "n"');
  });

  // The regression this fix targets: an "answer the posed question" step. The baked
  // model_answer is the posed question, but the real answer is modeled in the next
  // play and must reach the grader as alt_model_answer so it can grade the answer.
  it('surfaces the real answer via alt_model_answer when model_answer is the posed question', () => {
    const msg = buildGradeUserMessage({
      modelAnswer: '¿Qué hiciste el sábado?',          // posed question (wrong target)
      altAnswer: 'El sábado fui a cenar.',              // the actual modeled answer
      transcript: 'El sábado fui a cenar, pero volví a casa temprano.',
      playText: '¿Qué hiciste el sábado? Now answer about your Saturday.',
      nextText: 'El sábado fui a cenar.',
    });
    expect(msg).toContain('model_answer: "¿Qué hiciste el sábado?"');
    expect(msg).toContain('alt_model_answer: "El sábado fui a cenar."');
    // grader receives both, so it can prefer the answer over the posed question
  });
});

describe('normalizeGrade', () => {
  it('passes through a valid grade and trims correct_answer', () => {
    const g = normalizeGrade({
      label: 'Excellent',
      brief_feedback: 'Nice.',
      observed_errors: [{ category: 'grammar', description: 'x' }],
      correct_answer: '  El sábado fui a cenar.  ',
    });
    expect(g.label).toBe('Excellent');
    expect(g.brief_feedback).toBe('Nice.');
    expect(g.observed_errors).toEqual([{ category: 'grammar', description: 'x' }]);
    expect(g.correct_answer).toBe('El sábado fui a cenar.');
  });

  it('falls back to Ok for an invalid or missing label', () => {
    expect(normalizeGrade({ label: 'Perfect' }).label).toBe('Ok');
    expect(normalizeGrade({}).label).toBe('Ok');
    expect(normalizeGrade(null).label).toBe('Ok');
  });

  it('never throws and always returns a usable shape on garbage input', () => {
    const g = normalizeGrade('not an object');
    expect(g.label).toBe('Ok');
    expect(g.brief_feedback).toBe('');
    expect(g.observed_errors).toEqual([]);
  });

  it('drops blank correct_answer / suggested_answer fields', () => {
    const g = normalizeGrade({ label: 'Good', correct_answer: '   ', suggested_answer: '' });
    expect(g.correct_answer).toBeUndefined();
    expect(g.suggested_answer).toBeUndefined();
  });

  it('coerces malformed observed_errors entries instead of crashing', () => {
    const g = normalizeGrade({ label: 'Ok', observed_errors: [{ category: 'vocab' }, null, 'bad', 42] });
    expect(g.observed_errors).toEqual([{ category: 'vocab', description: '' }]);
  });

  it('treats a non-array observed_errors as empty', () => {
    expect(normalizeGrade({ label: 'Ok', observed_errors: 'oops' }).observed_errors).toEqual([]);
  });
});
