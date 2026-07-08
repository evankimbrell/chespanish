import { describe, it, expect } from 'vitest';
import { needsReview, reviewCount, splitForReview, replayAnswer, type GradedResponse } from './lesson-review';
import type { LessonGrade } from './types';

let seq = 0;
const resp = (over: Partial<GradedResponse> = {}): GradedResponse => ({
  id: ++seq,
  playIdx: seq,
  at: '2026-07-08T12:00:00.000Z',
  promptText: 'Say: you have to charge your SUBE card',
  transcript: 'Tenés que cargar la SUBE',
  grade: null,
  ...over,
});
const graded = (label: LessonGrade['label'], gradeOver: Partial<LessonGrade> = {}, over: Partial<GradedResponse> = {}) =>
  resp({ grade: { label, brief_feedback: '', observed_errors: [], ...gradeOver }, ...over });

describe('needsReview', () => {
  it('flags only clear misses — Almost and Ouch', () => {
    expect(needsReview('Almost')).toBe(true);
    expect(needsReview('Ouch')).toBe(true);
  });
  it('lets Excellent/Good/Ok cruise through', () => {
    expect(needsReview('Excellent')).toBe(false);
    expect(needsReview('Good')).toBe(false);
    expect(needsReview('Ok')).toBe(false);
  });
  it('is false while the grade is unknown', () => {
    expect(needsReview(undefined)).toBe(false);
  });
});

describe('reviewCount', () => {
  it('counts misses, ignoring pending and failed grades', () => {
    const results = [
      graded('Ouch'),
      graded('Good'),
      graded('Almost'),
      resp(),                        // still grading
      resp({ gradeFailed: true }),   // grading errored
    ];
    expect(reviewCount(results)).toBe(2);
  });
  it('is 0 for an empty session', () => {
    expect(reviewCount([])).toBe(0);
  });
});

describe('splitForReview', () => {
  it('sends misses to review and everything else to rest, preserving lesson order', () => {
    const ouch = graded('Ouch');
    const good = graded('Good');
    const almost = graded('Almost');
    const ok = graded('Ok');
    const pending = resp();
    const failed = resp({ gradeFailed: true });
    const { review, rest } = splitForReview([good, ouch, ok, almost, pending, failed]);
    expect(review).toEqual([ouch, almost]);
    expect(rest).toEqual([good, ok, pending, failed]);
  });
});

describe('replayAnswer', () => {
  it('prefers the grader’s correct_answer for THIS response', () => {
    const r = graded('Almost', { correct_answer: 'Tenés que cargar la SUBE', suggested_answer: 'otra cosa' }, { expected: 'baked' });
    expect(replayAnswer(r)).toBe('Tenés que cargar la SUBE');
  });
  it('falls back to suggested_answer, then the baked expected answer', () => {
    expect(replayAnswer(graded('Almost', { suggested_answer: 'Quiero un café' }))).toBe('Quiero un café');
    expect(replayAnswer(resp({ expected: 'La heladera está rota' }))).toBe('La heladera está rota');
  });
  it('returns null when nothing usable exists (never guesses)', () => {
    expect(replayAnswer(resp())).toBeNull();
    expect(replayAnswer(graded('Ok', { correct_answer: '  ' }))).toBeNull();
  });
});
