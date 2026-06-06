import { describe, it, expect } from 'vitest';
import { condenseLevelTestReport, buildCombinedReport, buildNextLessonBriefPrompt } from './next-lesson-brief';
import { DESIGN_BRIEF_PROMPT } from './lesson-design';
import type { TestReport } from './types';

const testReport: TestReport = {
  overall_score: 58,
  display_level: 'B1',
  cefr_band: 'B1',
  confidence: 'medium',
  confidence_range: [52, 64],
  summary: 'Solid A2, emerging B1; hesitant with past tense.',
  skill_scores: {} as TestReport['skill_scores'],
  strengths: ['Greetings', 'Present tense'],
  weaknesses: ['Past tense', 'vos conjugation'],
  most_common_error_categories: ['Conjugation', 'Naturalness'],
  next_level_gap: 'Needs reliable preterite to reach B1.',
  recommended_first_lesson: { title: 'Talking About Last Weekend', scenario: 'social', focus_points: ['preterite', 'time markers'], why: 'High-frequency past-tense practice.' },
  next_three_lessons: [],
};

describe('condenseLevelTestReport', () => {
  it('condenses a structured TestReport into the key diagnosis lines', () => {
    const out = condenseLevelTestReport({ testReport });
    expect(out).toContain('Level: B1');
    expect(out).toContain('Strengths: Greetings; Present tense.');
    expect(out).toContain('Weaknesses: Past tense; vos conjugation.');
    expect(out).toContain('Most common error categories: Conjugation, Naturalness.');
    expect(out).toContain('Originally recommended first lesson: "Talking About Last Weekend"');
  });

  it('falls back to a truncated educator report when no TestReport', () => {
    expect(condenseLevelTestReport({ educatorReport: 'Student is doing well.' })).toBe('Student is doing well.');
    expect(condenseLevelTestReport(null)).toMatch(/No placement test data/);
  });
});

describe('buildCombinedReport', () => {
  it('labels both the placement diagnosis and first-lesson report', () => {
    const out = buildCombinedReport('LEVEL', 'LESSON');
    expect(out).toContain('(A) CONDENSED PLACEMENT DIAGNOSIS');
    expect(out).toContain('LEVEL');
    expect(out).toContain('(B) FIRST LESSON REPORT');
    expect(out).toContain('LESSON');
  });
});

describe('buildNextLessonBriefPrompt', () => {
  const combined = 'COMBINED_REPORT_BLOCK';
  const prompt = buildNextLessonBriefPrompt(DESIGN_BRIEF_PROMPT, combined);

  it('injects the combined report in place of the [TEST_DATA] placeholder', () => {
    expect(DESIGN_BRIEF_PROMPT).toContain('[TEST_DATA]'); // guards against upstream drift
    expect(prompt).toContain('COMBINED_REPORT_BLOCK');
    expect(prompt).not.toContain('[TEST_DATA]');
  });

  it('reframes the task for a student who has completed a lesson', () => {
    expect(prompt).toContain("designing the student's NEXT personalized audio lesson");
    expect(prompt).toContain('create a clear next-lesson design brief');
    expect(prompt).toMatch(/Treat recurring mistakes .* as high priority/);
    expect(prompt).toContain('do NOT simply repeat the first lesson');
  });

  it('inherits the section spec and JSON output format unchanged', () => {
    expect(prompt).toContain('Estimated Student Level');
    expect(prompt).toContain('Final Performance Task');
    expect(prompt).toContain('"focus_points"');
    expect(prompt).toContain('```json');
  });

  it('all replacement anchors exist in the base prompt (no silent no-ops)', () => {
    for (const anchor of [
      'creating the first personalized audio lesson for a student after a Spanish level test.',
      'create a clear first-lesson design brief',
      'produce a first-lesson design brief with the following sections',
      'Here is the student information:',
    ]) {
      expect(DESIGN_BRIEF_PROMPT).toContain(anchor);
    }
  });
});
