import { describe, it, expect } from 'vitest';
import { gradeProvidedAnswer, buildCorrectAnswerMessage } from './correct-answer';

describe('gradeProvidedAnswer', () => {
  it('prefers correct_answer, then suggested_answer', () => {
    expect(gradeProvidedAnswer({ correct_answer: '¿Tenés tiempo?', suggested_answer: 'x' })).toBe('¿Tenés tiempo?');
    expect(gradeProvidedAnswer({ suggested_answer: '¿Tenés tiempo?' })).toBe('¿Tenés tiempo?');
  });
  it('returns null when neither is present or grade is missing', () => {
    expect(gradeProvidedAnswer({})).toBeNull();
    expect(gradeProvidedAnswer(null)).toBeNull();
    expect(gradeProvidedAnswer({ correct_answer: '   ' })).toBeNull();
  });
});

describe('buildCorrectAnswerMessage', () => {
  it('includes the step and labels the baked answer as a hint that may be wrong', () => {
    const msg = buildCorrectAnswerMessage({
      modelAnswer: 'PREVIOUS STEP ANSWER',
      altAnswer: 'Mañana voy a ver a un amigo.',
      prevText: 'prev',
      playText: 'Say that tomorrow you are going to meet up with a friend.',
      nextText: 'next',
      sectionName: 'Meeting Up Naturally',
    });
    expect(msg).toContain('this_step: "Say that tomorrow you are going to meet up with a friend."');
    expect(msg).toContain('model_answer (hint, may be wrong): "PREVIOUS STEP ANSWER"');
    expect(msg).toContain('alt_model_answer: "Mañana voy a ver a un amigo."');
    expect(msg).toContain('context_before: "prev"');
    expect(msg).toContain('context_after: "next"');
    expect(msg).toContain('section_name: "Meeting Up Naturally"');
  });
  it('omits optional fields when absent', () => {
    const msg = buildCorrectAnswerMessage({ playText: 'Say hello.' });
    expect(msg).toContain('this_step: "Say hello."');
    expect(msg).not.toContain('model_answer');
    expect(msg).not.toContain('alt_model_answer');
    expect(msg).not.toContain('context_before');
    expect(msg).not.toContain('context_after');
    expect(msg).not.toContain('section_name');
  });
});
