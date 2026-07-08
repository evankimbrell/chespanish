import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SRS_CONFIG,
  scheduleCard,
  previewIntervals,
  formatInterval,
  buildQueue,
  requeueIndex,
  countsByState,
  todaysLog,
  createCardsForNote,
  allowedDirections,
} from './srs';
import type { VocabCard, VocabGrade, VocabReviewRecord } from './types';

const NOW = new Date('2026-06-10T12:00:00.000Z');
const noFuzz = () => 0.5;
const cfg = DEFAULT_SRS_CONFIG;

function card(over: Partial<VocabCard> = {}): VocabCard {
  return {
    id: 'n1:recognize', noteId: 'n1', direction: 'recognize',
    state: 'new', due: NOW.toISOString(), intervalDays: 0,
    ease: 2.5, reps: 0, lapses: 0, stepIndex: 0,
    ...over,
  };
}

const minutesFromNow = (c: VocabCard) => (new Date(c.due).getTime() - NOW.getTime()) / 60000;

describe('scheduleCard — learning phase', () => {
  it('new + Good → learning step 1 (10m)', () => {
    const c = scheduleCard(card(), 'good', NOW, cfg, noFuzz);
    expect(c.state).toBe('learning');
    expect(c.stepIndex).toBe(1);
    expect(minutesFromNow(c)).toBe(10);
    expect(c.reps).toBe(1);
  });

  it('new + Again → step 0 (1m)', () => {
    const c = scheduleCard(card(), 'again', NOW, cfg, noFuzz);
    expect(c.state).toBe('learning');
    expect(c.stepIndex).toBe(0);
    expect(minutesFromNow(c)).toBe(1);
  });

  it('learning Hard repeats the current step', () => {
    const c = scheduleCard(card({ state: 'learning', stepIndex: 1 }), 'hard', NOW, cfg, noFuzz);
    expect(c.state).toBe('learning');
    expect(c.stepIndex).toBe(1);
    expect(minutesFromNow(c)).toBe(10);
  });

  it('Good past the last step graduates to review at 1d', () => {
    const c = scheduleCard(card({ state: 'learning', stepIndex: 1 }), 'good', NOW, cfg, noFuzz);
    expect(c.state).toBe('review');
    expect(c.intervalDays).toBe(1);
    expect(minutesFromNow(c)).toBe(1440);
  });

  it('new + Easy graduates immediately at 4d', () => {
    const c = scheduleCard(card(), 'easy', NOW, cfg, noFuzz);
    expect(c.state).toBe('review');
    expect(c.intervalDays).toBe(4);
  });

  it('ease is untouched while learning', () => {
    const c = scheduleCard(card(), 'again', NOW, cfg, noFuzz);
    expect(c.ease).toBe(2.5);
  });
});

describe('scheduleCard — review phase', () => {
  const rev = card({ state: 'review', intervalDays: 10, ease: 2.5, reps: 5 });

  it('Good multiplies by ease (10d × 2.5 = 25d)', () => {
    const c = scheduleCard(rev, 'good', NOW, cfg, noFuzz);
    expect(c.intervalDays).toBe(25);
    expect(c.ease).toBe(2.5);
  });

  it('Hard: ×1.2 and ease −0.15', () => {
    const c = scheduleCard(rev, 'hard', NOW, cfg, noFuzz);
    expect(c.intervalDays).toBe(12);
    expect(c.ease).toBe(2.35);
  });

  it('Easy: ×ease×1.3 and ease +0.15', () => {
    const c = scheduleCard(rev, 'easy', NOW, cfg, noFuzz);
    expect(c.intervalDays).toBe(Math.round(10 * 2.5 * 1.3));
    expect(c.ease).toBe(2.65);
  });

  it('Again lapses: relearning, lapses+1, ease −0.20, interval reset to 1d', () => {
    const c = scheduleCard(rev, 'again', NOW, cfg, noFuzz);
    expect(c.state).toBe('relearning');
    expect(c.lapses).toBe(1);
    expect(c.ease).toBe(2.3);
    expect(c.intervalDays).toBe(1); // lapseIntervalFactor 0 → min 1d
    expect(minutesFromNow(c)).toBe(10); // relearning step
  });

  it('relearning + Good re-graduates to review at the stored interval', () => {
    const relearn = card({ state: 'relearning', stepIndex: 0, intervalDays: 1, lapses: 1, ease: 2.3 });
    const c = scheduleCard(relearn, 'good', NOW, cfg, noFuzz);
    expect(c.state).toBe('review');
    expect(c.intervalDays).toBe(1);
  });

  it('ease never drops below 1.3', () => {
    const c = scheduleCard(card({ state: 'review', intervalDays: 5, ease: 1.35 }), 'again', NOW, cfg, noFuzz);
    expect(c.ease).toBe(1.3);
  });

  it('interval never exceeds maxIntervalDays', () => {
    const c = scheduleCard(card({ state: 'review', intervalDays: 300, ease: 2.5 }), 'good', NOW, cfg, noFuzz);
    expect(c.intervalDays).toBe(365);
  });

  it('a successful review is always ≥ previous interval + 1 day', () => {
    // Hard on a 1d card at ease floor: 1×1.2 rounds to 1 — must still land on 2d
    const c = scheduleCard(card({ state: 'review', intervalDays: 1, ease: 1.3 }), 'hard', NOW, cfg, noFuzz);
    expect(c.intervalDays).toBeGreaterThanOrEqual(2);
  });

  it('fuzz stays within ±5%', () => {
    const base = card({ state: 'review', intervalDays: 100, ease: 2.0 });
    const lo = scheduleCard(base, 'good', NOW, cfg, () => 0);
    const hi = scheduleCard(base, 'good', NOW, cfg, () => 0.9999);
    expect(lo.intervalDays).toBe(190); // 200 × 0.95
    expect(hi.intervalDays).toBeGreaterThanOrEqual(209);
    expect(hi.intervalDays).toBeLessThanOrEqual(210);
  });

  it('sub-day learning steps get no fuzz', () => {
    const c = scheduleCard(card(), 'again', NOW, cfg, () => 0);
    expect(minutesFromNow(c)).toBe(1);
  });
});

describe('previewIntervals', () => {
  it('labels a fresh card 1m / 10m / 1d / 4d', () => {
    expect(previewIntervals(card(), NOW)).toEqual({ again: '1m', hard: '1m', good: '10m', easy: '4d' });
  });
  it('labels a review card with day intervals and no fuzz', () => {
    const p = previewIntervals(card({ state: 'review', intervalDays: 10, ease: 2.5 }), NOW);
    expect(p.good).toBe('25d');
    expect(p.hard).toBe('12d');
    expect(p.again).toBe('10m');
  });
});

describe('formatInterval', () => {
  it('formats minutes, hours, days, months, years', () => {
    expect(formatInterval(1)).toBe('1m');
    expect(formatInterval(10)).toBe('10m');
    expect(formatInterval(600)).toBe('10h');
    expect(formatInterval(1440)).toBe('1d');
    expect(formatInterval(4320)).toBe('3d');
    expect(formatInterval(1440 * 60)).toBe('2mo');
    expect(formatInterval(1440 * 365)).toBe('1yr');
  });
});

describe('buildQueue', () => {
  const past = (min: number) => new Date(NOW.getTime() - min * 60000).toISOString();
  const future = (min: number) => new Date(NOW.getTime() + min * 60000).toISOString();

  it('orders due reviews → due learning → new, and excludes non-due', () => {
    const cards = [
      card({ id: 'a:recognize', noteId: 'a', state: 'new' }),
      card({ id: 'b:recognize', noteId: 'b', state: 'learning', due: past(5) }),
      card({ id: 'c:recognize', noteId: 'c', state: 'review', due: past(60) }),
      card({ id: 'd:recognize', noteId: 'd', state: 'review', due: future(60) }), // not due
    ];
    const q = buildQueue(cards, NOW, cfg);
    expect(q.map((c) => c.noteId)).toEqual(['c', 'b', 'a']);
  });

  it('sorts reviews overdue-first', () => {
    const cards = [
      card({ id: 'a:recognize', noteId: 'a', state: 'review', due: past(10) }),
      card({ id: 'b:recognize', noteId: 'b', state: 'review', due: past(600) }),
    ];
    expect(buildQueue(cards, NOW, cfg).map((c) => c.noteId)).toEqual(['b', 'a']);
  });

  it('buries siblings — one card per note per session', () => {
    const cards = [
      card({ id: 'a:recognize', noteId: 'a', state: 'review', due: past(10) }),
      card({ id: 'a:recall', noteId: 'a', direction: 'recall', state: 'new' }),
      card({ id: 'b:recall', noteId: 'b', direction: 'recall', state: 'new' }),
    ];
    const q = buildQueue(cards, NOW, cfg);
    expect(q.map((c) => c.id)).toEqual(['a:recognize', 'b:recall']);
  });

  it('caps new cards by newPerDay minus today’s introductions', () => {
    const cards = Array.from({ length: 30 }, (_, i) => card({ id: `n${i}:recognize`, noteId: `n${i}` }));
    const log: VocabReviewRecord[] = Array.from({ length: 15 }, (_, i) => ({
      at: NOW.toISOString(), deckId: 'd', cardId: `x${i}`, noteId: `x${i}`, direction: 'recognize',
      grade: 'good' as VocabGrade, prevState: 'new', prevIntervalDays: 0,
      newState: 'learning', newIntervalDays: 0, newDue: NOW.toISOString(),
    }));
    expect(buildQueue(cards, NOW, cfg, log)).toHaveLength(5); // 20 − 15
  });

  it('caps reviews by reviewsPerDay', () => {
    const tiny = { ...cfg, reviewsPerDay: 2 };
    const cards = [1, 2, 3].map((i) => card({ id: `n${i}:recognize`, noteId: `n${i}`, state: 'review', due: past(i) }));
    expect(buildQueue(cards, NOW, tiny)).toHaveLength(2);
  });
});

describe('requeueIndex', () => {
  it('inserts a learning card before later-due learning and before new cards', () => {
    const q = [
      card({ id: 'a:recognize', noteId: 'a', state: 'learning', due: new Date(NOW.getTime() + 2 * 60000).toISOString() }),
      card({ id: 'b:recognize', noteId: 'b', state: 'new' }),
    ];
    const incoming = card({ id: 'c:recognize', noteId: 'c', state: 'learning', due: new Date(NOW.getTime() + 60000).toISOString() });
    expect(requeueIndex(q, incoming)).toBe(0);
    const late = card({ id: 'd:recognize', noteId: 'd', state: 'learning', due: new Date(NOW.getTime() + 99 * 60000).toISOString() });
    expect(requeueIndex(q, late)).toBe(1); // after learning 'a', before new 'b'
  });
  it('returns queue length for an empty queue', () => {
    expect(requeueIndex([], card())).toBe(0);
  });
});

describe('countsByState / todaysLog', () => {
  it('buckets new/learning/due correctly', () => {
    const laterToday = new Date(NOW); laterToday.setHours(20, 0, 0, 0);
    const cards = [
      card({ noteId: 'a' }),
      card({ noteId: 'b', state: 'learning', due: laterToday.toISOString() }),
      card({ noteId: 'c', state: 'review', due: new Date(NOW.getTime() - 1000).toISOString() }),
      card({ noteId: 'd', state: 'review', due: new Date(NOW.getTime() + 86400_000 * 3).toISOString() }),
    ];
    expect(countsByState(cards, NOW)).toEqual({ newCount: 1, learning: 1, due: 1 });
  });

  it('todaysLog filters to the local day', () => {
    const log = [
      { at: NOW.toISOString() },
      { at: new Date(NOW.getTime() - 86400_000 * 2).toISOString() },
    ] as VocabReviewRecord[];
    expect(todaysLog(log, NOW)).toHaveLength(1);
  });
});

describe('createCardsForNote / allowedDirections', () => {
  it('creates both siblings, due immediately, ease 2.5', () => {
    const cards = createCardsForNote('n9', NOW);
    expect(cards.map((c) => c.id)).toEqual(['n9:recognize', 'n9:recall']);
    expect(cards.every((c) => c.state === 'new' && c.ease === 2.5 && c.due === NOW.toISOString())).toBe(true);
  });
  it('maps deck direction settings', () => {
    expect(allowedDirections('both')).toEqual(['recognize', 'recall']);
    expect(allowedDirections('recognize')).toEqual(['recognize']);
    expect(allowedDirections('recall')).toEqual(['recall']);
  });
});
