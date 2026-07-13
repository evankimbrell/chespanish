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

describe('computeRetention · overall + user timezone', () => {
  it('overallPct counts every answer, learning steps included', () => {
    const log = [
      rec({ prevState: 'new', grade: 'good' }),
      rec({ prevState: 'learning', grade: 'good' }),
      rec({ prevState: 'learning', grade: 'hard' }), // hard is correct
      rec({ prevState: 'new', grade: 'again' }),
    ];
    const r = computeRetention(log, NOW);
    expect(r.overallPct).toBe(75);
    expect(r.maturePct).toBeNull(); // review-only buckets stay empty
  });

  it('overallPct is null with an empty log', () => {
    expect(computeRetention([], NOW).overallPct).toBeNull();
  });

  it('an evening session straddling midnight UTC is ONE local day (ART, tz=180)', () => {
    // 23:50Z and 00:20Z are 20:50 and 21:20 in Buenos Aires — same evening.
    const log = [
      rec({ at: '2026-06-10T23:50:00.000Z' }),
      rec({ at: '2026-06-11T00:20:00.000Z' }),
    ];
    const now = new Date('2026-06-11T00:30:00.000Z'); // 21:30 ART, June 10
    expect(computeRetention(log, now, 180).streakDays).toBe(1);
    expect(computeRetention(log, now, 0).streakDays).toBe(2); // the UTC bug this fixes
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

describe('dueForecast · user timezone', () => {
  it('buckets by the user-local day, not the UTC day', () => {
    // Card due 01:00Z tomorrow = 22:00 ART today → bucket 0 for ART, bucket 1 for UTC.
    const now = new Date('2026-06-10T23:00:00.000Z'); // 20:00 ART June 10
    const cards = [card({ due: '2026-06-11T01:00:00.000Z' })];
    expect(dueForecast(cards, now, 7, 180)[0]).toBe(1);
    expect(dueForecast(cards, now, 7, 0)[1]).toBe(1);
  });
});

describe('estimateMinutes', () => {
  it('estimates ~12.5s per card, ceiled', () => {
    expect(estimateMinutes(43)).toBe(9);
    expect(estimateMinutes(0)).toBe(0);
    expect(estimateMinutes(1)).toBe(1);
  });
});
