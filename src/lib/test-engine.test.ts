import { describe, it, expect } from 'vitest';
import { initEngine, updateEngine, advanceWithoutEvidence } from './test-engine';
import type { Question, PromptResult } from './types';

const q = (over: Partial<Question> = {}): Question => ({
  prompt_id: 'q1',
  prompt_type: 'grammar_in_context',
  difficulty_score: 7.8,
  difficulty_bucket: 'B2',
  cefr_band: 'B2',
  audio_text: '',
  instruction_text: 'Say something',
  ...over,
} as Question);

const result = (over: Partial<PromptResult> = {}): PromptResult => ({
  promptIndex: 0, questionId: 'q1', promptType: 'grammar_in_context',
  promptDifficulty: 7.8, promptBucket: 'B2', promptText: '',
  transcript: 'x', usedTranscriptHelp: false, skipped: false,
  responseTimeSeconds: 2, speakingDurationSeconds: 2, wordsPerMinute: null,
  overallScore: null, evidenceScore: null,
  abilityEstimateBefore: 0, abilityEstimateAfter: 0,
  grade: null, briefFeedback: '',
  ...over,
} as PromptResult);

describe('initEngine comfort seeding', () => {
  it('seeds at band centroids, not band top edges', () => {
    // The old top-edge seeds (4.2 / 6.2 / 8.2) fell in empty gaps of the question
    // bank and pulled first questions a full band too high.
    expect(initEngine(2).abilityEstimate).toBe(3.5); // studied a little → mid-A2
    expect(initEngine(3).abilityEstimate).toBe(5.5); // basic conversations → mid-B1
    expect(initEngine(4).abilityEstimate).toBe(7.5); // comfortable → mid-B2
  });
  it('keeps the extremes', () => {
    expect(initEngine(0).abilityEstimate).toBe(0.5);
    expect(initEngine(1).abilityEstimate).toBe(2.2);
    expect(initEngine(5).abilityEstimate).toBe(9.5);
  });
});

describe('advanceWithoutEvidence', () => {
  it('advances bookkeeping but never the estimate, target, or streaks', () => {
    const eng = initEngine(2);
    const after = advanceWithoutEvidence(eng, q());
    expect(after.promptCount).toBe(1);
    expect(after.askedIds).toEqual(['q1']);
    expect(after.recentTypes).toEqual(['grammar_in_context']);
    expect(after.skillCoverage.grammar_structured).toBe(1);
    // The bug this guards against: a failed grade used to count as a "Good" (3),
    // building a high streak and climbing the difficulty ladder.
    expect(after.abilityEstimate).toBe(eng.abilityEstimate);
    expect(after.nextTargetDifficulty).toBe(eng.nextTargetDifficulty);
    expect(after.consecutiveHighScores).toBe(0);
    expect(after.consecutiveLowScores).toBe(0);
  });

  it('ten graded failures leave the estimate exactly where it started', () => {
    let eng = initEngine(2);
    for (let i = 0; i < 10; i++) eng = advanceWithoutEvidence(eng, q({ prompt_id: `q${i}` }));
    expect(eng.abilityEstimate).toBe(3.5);
    expect(eng.promptCount).toBe(10);
  });
});

describe('updateEngine with real scores (contrast)', () => {
  it('a real low score drops the target; a real high score raises it', () => {
    const eng = initEngine(3);
    const low = updateEngine(eng, 0, result({ overallScore: 0 }), q({ difficulty_score: 5.8 }));
    expect(low.nextTargetDifficulty).toBeLessThan(5.8);
    expect(low.consecutiveLowScores).toBe(1);
    const high = updateEngine(eng, 5, result({ overallScore: 5 }), q({ difficulty_score: 5.8 }));
    expect(high.nextTargetDifficulty).toBeGreaterThan(5.8);
    expect(high.consecutiveHighScores).toBe(1);
  });
});
