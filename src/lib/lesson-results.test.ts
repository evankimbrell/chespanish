import { describe, it, expect } from 'vitest';
import { summarizeLessonResults, formatFirstLessonReport } from './lesson-results';
import type { LessonActivityRecord, LessonHistoryEntry, LessonGrade } from './types';

function resp(over: Partial<Extract<LessonActivityRecord, { type: 'response' }>> = {}): LessonActivityRecord {
  return {
    type: 'response',
    at: '2026-06-06T10:00:10.000Z',
    lessonId: 'L1',
    lessonTitle: 'Changing Plans Naturally',
    sectionName: 'Changing Plans Core',
    promptText: 'Say you can meet tomorrow.',
    expected: 'Puedo mañana.',
    transcript: 'Puedo mañana.',
    grade: { label: 'Excellent', brief_feedback: 'Great.', observed_errors: [] } as LessonGrade,
    ...over,
  };
}

const history: LessonHistoryEntry = {
  id: 'L1',
  title: 'Changing Plans Naturally',
  transcript: '',
  startedAt: '2026-06-06T10:00:00.000Z',
  lastAccessedAt: '2026-06-06T10:12:00.000Z', // 12 min later
  playIdx: 30,
  totalCount: 30,
  completed: true,
  topics: ['Opening Warm Up', 'Changing Plans Core'],
};

describe('summarizeLessonResults', () => {
  it('uses the real lesson title and computes duration from history', () => {
    const r = summarizeLessonResults({ lessonId: 'L1', records: [resp()], history });
    expect(r.lessonTitle).toBe('Changing Plans Naturally');
    expect(r.durationSec).toBe(12 * 60);
    expect(r.completed).toBe(true);
  });

  it('averages grade labels into a 0–100 score', () => {
    const records = [
      resp({ grade: { label: 'Excellent', brief_feedback: '', observed_errors: [] } }), // 100
      resp({ grade: { label: 'Ok', brief_feedback: '', observed_errors: [] } }),        // 70
    ];
    const r = summarizeLessonResults({ lessonId: 'L1', records, history });
    expect(r.score).toBe(85);
    expect(r.labelCounts).toEqual({ Excellent: 1, Ok: 1 });
    expect(r.responseCount).toBe(2);
  });

  it('builds a mistake per observed error with you-said / target / section', () => {
    const records = [
      resp({
        transcript: '¿Tienes tiempo?',
        grade: {
          label: 'Almost',
          brief_feedback: 'Use vos.',
          observed_errors: [{ category: 'Conjugation', description: 'Used "tienes" instead of "tenés"' }],
          correct_answer: '¿Tenés tiempo?',
        },
      }),
    ];
    const r = summarizeLessonResults({ lessonId: 'L1', records, history });
    expect(r.mistakes).toHaveLength(1);
    expect(r.mistakes[0]).toMatchObject({
      category: 'Conjugation',
      description: 'Used "tienes" instead of "tenés"',
      severity: 'med',
      youSaid: '¿Tienes tiempo?',
      target: '¿Tenés tiempo?',
      sectionName: 'Changing Plans Core',
    });
    expect(r.mistakes[0].atOffsetSec).toBe(10); // 10s after startedAt
  });

  it('does not flag Excellent/Good responses with no errors as mistakes', () => {
    const r = summarizeLessonResults({ lessonId: 'L1', records: [resp(), resp({ grade: { label: 'Good', brief_feedback: '', observed_errors: [] } })], history });
    expect(r.mistakes).toHaveLength(0);
    expect(r.mistakeCounts).toEqual({ total: 0, new: 0, recurring: 0 });
  });

  it('marks a category as recurring when seen in an earlier lesson', () => {
    const earlier = resp({
      lessonId: 'L0',
      at: '2026-06-01T09:00:00.000Z', // before this lesson
      grade: { label: 'Almost', brief_feedback: '', observed_errors: [{ category: 'Conjugation', description: 'old' }] },
    });
    const current = resp({
      grade: { label: 'Almost', brief_feedback: '', observed_errors: [{ category: 'Conjugation', description: 'again' }] },
    });
    const r = summarizeLessonResults({ lessonId: 'L1', records: [earlier, current], history });
    expect(r.mistakeCounts).toEqual({ total: 1, new: 0, recurring: 1 });
  });

  it('only counts records for the requested lesson', () => {
    const other = resp({ lessonId: 'L2', lessonTitle: 'Other' });
    const r = summarizeLessonResults({ lessonId: 'L1', records: [resp(), other], history });
    expect(r.responseCount).toBe(1);
  });

  it('collects concepts and questions, and averages recall timing', () => {
    const records = [
      resp({ sectionName: 'A', timing: { recordingSec: 4, speakingSpanSec: 3, voicedSec: 2, silenceSec: 1, silencePct: 25, initialSilenceSec: 1.0, trailingSilenceSec: 0.2, longestPauseSec: 0, pauses: [], wordCount: 3, wpm: 90 } }),
      resp({ sectionName: 'B', timing: { recordingSec: 6, speakingSpanSec: 5, voicedSec: 3, silenceSec: 3, silencePct: 50, initialSilenceSec: 2.0, trailingSilenceSec: 0.2, longestPauseSec: 0, pauses: [], wordCount: 5, wpm: 110 } }),
      { type: 'question', at: '2026-06-06T10:05:00.000Z', lessonId: 'L1', question: '¿cómo?' } as LessonActivityRecord,
    ];
    const r = summarizeLessonResults({ lessonId: 'L1', records, history });
    expect(r.conceptsCovered).toEqual(['A', 'B']);
    expect(r.questionCount).toBe(1);
    expect(r.avgRecallSec).toBe(1.5);
    expect(r.avgWpm).toBe(100);
  });

  it('falls back to the activity-timestamp span when history has no times', () => {
    const records = [
      resp({ at: '2026-06-06T10:00:00.000Z' }),
      resp({ at: '2026-06-06T10:03:00.000Z' }),
    ];
    const r = summarizeLessonResults({ lessonId: 'L1', records, fallbackTitle: 'Untitled' });
    expect(r.lessonTitle).toBe('Changing Plans Naturally'); // from record's lessonTitle
    expect(r.durationSec).toBe(180);
  });
});

describe('formatFirstLessonReport', () => {
  it('renders title, score, concepts and itemized mistakes', () => {
    const records = [
      resp({
        transcript: '¿Tienes tiempo?',
        grade: { label: 'Almost', brief_feedback: 'Use vos.', observed_errors: [{ category: 'Conjugation', description: 'tienes → tenés' }], correct_answer: '¿Tenés tiempo?' },
      }),
    ];
    const r = summarizeLessonResults({ lessonId: 'L1', records, history });
    const text = formatFirstLessonReport(r);
    expect(text).toContain('Lesson completed: "Changing Plans Naturally"');
    expect(text).toContain('Mistakes (1 total: 1 new, 0 recurring)');
    expect(text).toContain('[Conjugation] tienes → tenés');
    expect(text).toContain('target: "¿Tenés tiempo?"');
  });
});
