import { describe, it, expect } from 'vitest';
import { computeRetention, computeStreak, dueForecast, estimateMinutes } from './vocab-stats';
import type { VocabCard, VocabReviewRecord } from './types';

const NOW = new Date('2026-06-10T12:00:00.000Z');
const DAY = 86_400_000;

function rec(over: Partial<VocabReviewRecord>): VocabReviewRecord {
  return {
    at: NOW.toISOString(), deckId: 'd', cardId: 'c', noteId: 'n', direction: 'recognize',
    grade: 'good', prevState: 'review', prevIntervalDays: 30,
    newState: 'review', newIntervalDays: 75, newDue: NOW.toISOString(),
    ...over,
  };
}

function card(over: Partial<VocabCard>): VocabCard {
  return {
    id: 'n:recognize', noteId: 'n', direction: 'recognize', state: 'review',
    due: NOW.toISOString(), intervalDays: 5, ease: 2.5, reps: 3, lapses: 0, stepIndex: 0,
    ...over,
  };
}

describe('computeRetention', () => {
  it('splits mature (≥21d) vs young and counts Again as incorrect', () => {
    const log = [
      rec({ prevIntervalDays: 30, grade: 'good' }),
      rec({ prevIntervalDays: 25, grade: 'again' }),
      rec({ prevIntervalDays: 5, grade: 'good' }),
      rec({ prevIntervalDays: 3, grade: 'hard' }), // hard counts as correct
    ];
    const r = computeRetention(log, NOW);
    expect(r.maturePct).toBe(50);
    expect(r.youngPct).toBe(100);
  });

  it('ignores learning-phase records and reviews outside the 30d window', () => {
    const log = [
      rec({ prevState: 'new' }),
      rec({ prevState: 'learning' }),
      rec({ at: new Date(NOW.getTime() - 40 * DAY).toISOString() }),
    ];
    const r = computeRetention(log, NOW);
    expect(r.maturePct).toBeNull();
    expect(r.youngPct).toBeNull();
  });
});

describe('computeStreak', () => {
  const onDay = (d: number) => rec({ at: new Date(NOW.getTime() - d * DAY).toISOString() });
  it('counts consecutive days ending today', () => {
    expect(computeStreak([onDay(0), onDay(1), onDay(2)], NOW)).toBe(3);
  });
  it('still counts when today has no reviews yet (ends yesterday)', () => {
    expect(computeStreak([onDay(1), onDay(2)], NOW)).toBe(2);
  });
  it('breaks on a gap', () => {
    expect(computeStreak([onDay(0), onDay(2)], NOW)).toBe(1);
    expect(computeStreak([onDay(3)], NOW)).toBe(0);
  });
  it('is 0 with no reviews', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });
});

describe('dueForecast', () => {
  it('buckets overdue into today and future by local day; excludes new + beyond horizon', () => {
    const cards = [
      card({ due: new Date(NOW.getTime() - 3 * DAY).toISOString() }),          // overdue → today
      card({ due: NOW.toISOString() }),                                        // today
      card({ due: new Date(NOW.getTime() + 1 * DAY).toISOString() }),          // tomorrow
      card({ due: new Date(NOW.getTime() + 6 * DAY).toISOString() }),          // day 6
      card({ due: new Date(NOW.getTime() + 20 * DAY).toISOString() }),         // beyond
      card({ state: 'new' }),                                                  // excluded
      card({ state: 'learning', due: NOW.toISOString() }),                     // learning counts
    ];
    const f = dueForecast(cards, NOW, 7);
    expect(f).toHaveLength(7);
    expect(f[0]).toBe(3);
    expect(f[1]).toBe(1);
    expect(f[6]).toBe(1);
    expect(f.reduce((a, b) => a + b, 0)).toBe(5);
  });
});

describe('estimateMinutes', () => {
  it('estimates ~12.5s per card, ceiled', () => {
    expect(estimateMinutes(43)).toBe(9);
    expect(estimateMinutes(0)).toBe(0);
    expect(estimateMinutes(1)).toBe(1);
  });
});
