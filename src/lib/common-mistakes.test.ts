import { describe, it, expect } from 'vitest';
import { aggregateMistakes, formatMistakeForPrompt } from './common-mistakes';
import type { LessonActivityRecord, LessonGrade } from './types';

function resp(at: string, grade: Partial<LessonGrade>, over: Partial<Extract<LessonActivityRecord, { type: 'response' }>> = {}): LessonActivityRecord {
  return {
    type: 'response', at, lessonId: 'L1', lessonTitle: 'Lesson',
    sectionName: 'Core', promptText: 'Say it.', expected: 'tenés tiempo',
    transcript: '¿Tienes tiempo?',
    grade: { label: 'Almost', brief_feedback: '', observed_errors: [], ...grade } as LessonGrade,
    ...over,
  };
}

describe('aggregateMistakes', () => {
  it('matches a known pattern from the catalog by keyword', () => {
    const recs = [
      resp('2026-06-06T10:00:00Z', { observed_errors: [{ category: 'Conjugation', description: 'Used "tienes" instead of "tenés"' }], correct_answer: '¿Tenés tiempo?' }),
      resp('2026-06-05T10:00:00Z', { observed_errors: [{ category: 'Conjugation', description: 'tú form "quieres" — use "querés"' }] }),
    ];
    const out = aggregateMistakes(recs);
    const vos = out.find((m) => m.id === 'vos-conjugation');
    expect(vos).toBeDefined();
    expect(vos!.count).toBe(2);
    expect(vos!.name).toBe('Vos: tenés / querés / podés');
    expect(vos!.lastSeenAt).toBe('2026-06-06T10:00:00Z'); // most recent
    expect(vos!.examples[0].youSaid).toBe('¿Tienes tiempo?');
  });

  it('buckets unmatched errors by their category', () => {
    const out = aggregateMistakes([
      resp('2026-06-06T10:00:00Z', { observed_errors: [{ category: 'Vocabulary', description: 'wrong word for "spoon"' }] }),
    ]);
    const vocab = out.find((m) => m.category === 'Vocabulary');
    expect(vocab).toBeDefined();
    expect(vocab!.id).toBe('cat-vocabulary');
    expect(vocab!.count).toBe(1);
  });

  it('derives a slow-response mistake from timing', () => {
    const slowTiming = { recordingSec: 8, speakingSpanSec: 3, voicedSec: 2, silenceSec: 5, silencePct: 60, initialSilenceSec: 5.2, trailingSilenceSec: 0.3, longestPauseSec: 0, pauses: [], wordCount: 3, wpm: 60 };
    const out = aggregateMistakes([resp('2026-06-06T10:00:00Z', { label: 'Good', observed_errors: [] }, { timing: slowTiming })]);
    const slow = out.find((m) => m.id === 'slow-response');
    expect(slow).toBeDefined();
    expect(slow!.category).toBe('Speed');
    expect(slow!.examples[0].description).toContain('5.2s');
  });

  it('sorts by frequency and caps/sorts examples by recency', () => {
    const recs = [
      resp('2026-06-01T10:00:00Z', { observed_errors: [{ category: 'Conjugation', description: 'tienes' }] }),
      resp('2026-06-03T10:00:00Z', { observed_errors: [{ category: 'Conjugation', description: 'tienes' }] }),
      resp('2026-06-02T10:00:00Z', { observed_errors: [{ category: 'Naturalness', description: 'said deseo' }] }),
    ];
    const out = aggregateMistakes(recs);
    expect(out[0].id).toBe('vos-conjugation'); // 2 beats 1
    expect(out[0].examples[0].at).toBe('2026-06-03T10:00:00Z'); // most recent first
  });

  it('ignores question records', () => {
    const out = aggregateMistakes([{ type: 'question', at: '2026-06-06T10:00:00Z', lessonId: 'L1', question: '¿cómo?' } as LessonActivityRecord]);
    expect(out).toHaveLength(0);
  });
});

describe('formatMistakeForPrompt', () => {
  it('includes the level, the pattern, and the learner examples', () => {
    const [mistake] = aggregateMistakes([
      resp('2026-06-06T10:00:00Z', { observed_errors: [{ category: 'Conjugation', description: 'tienes → tenés' }], correct_answer: '¿Tenés tiempo?' }),
    ]);
    const block = formatMistakeForPrompt(mistake, 'B1');
    expect(block).toContain('Student level: B1');
    expect(block).toContain('Vos: tenés / querés / podés');
    expect(block).toContain('Typical error: tienes → correct: tenés.');
    expect(block).toContain('said: "¿Tienes tiempo?"');
    expect(block).toContain('target: "¿Tenés tiempo?"');
  });
});
