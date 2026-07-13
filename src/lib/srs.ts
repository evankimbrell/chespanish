import type {
  DeckDirectionSetting,
  VocabCard,
  VocabCardState,
  VocabDirection,
  VocabGrade,
  VocabReviewRecord,
} from './types';

// Classic Anki SM-2 scheduler. Pure functions only (no fs/fetch/Date.now) so every
// transition is unit-testable; callers pass `now` and (for fuzz) an injectable `rand`.
//
// Card lifecycle: new → learning (minute steps) → review (day intervals × ease)
//                 review + Again → relearning (minute steps) → review
// Queue order: due reviews → due learning/relearning (by timestamp) → new (daily cap).

export interface SrsConfig {
  learningStepsMin: number[];      // minute steps for new/learning cards
  relearningStepsMin: number[];    // minute steps after a lapse
  graduatingIntervalDays: number;  // Good past the last learning step
  easyIntervalDays: number;        // Easy while learning skips straight to review
  startingEase: number;
  minEase: number;
  againEaseDelta: number;
  hardEaseDelta: number;
  easyEaseDelta: number;
  hardIntervalFactor: number;      // review Hard: interval × this
  easyBonus: number;               // review Easy: interval × ease × this
  lapseIntervalFactor: number;     // interval kept after a lapse (Anki default 0 → restart)
  lapseMinIntervalDays: number;
  fuzzPct: number;                 // ±fraction applied to day intervals
  maxIntervalDays: number;
  newPerDay: number;
  reviewsPerDay: number;
  matureThresholdDays: number;     // interval ≥ this ⇒ "mature" (stats)
}

export const DEFAULT_SRS_CONFIG: SrsConfig = {
  learningStepsMin: [1, 10],
  relearningStepsMin: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEase: 2.5,
  minEase: 1.3,
  againEaseDelta: -0.2,
  hardEaseDelta: -0.15,
  easyEaseDelta: 0.15,
  hardIntervalFactor: 1.2,
  easyBonus: 1.3,
  lapseIntervalFactor: 0,
  lapseMinIntervalDays: 1,
  fuzzPct: 0.05,
  maxIntervalDays: 365,
  newPerDay: 20,
  reviewsPerDay: 200,
  matureThresholdDays: 21,
};

const MIN_PER_DAY = 24 * 60;
const MS_PER_MIN = 60_000;

const addMinutes = (d: Date, min: number) => new Date(d.getTime() + min * MS_PER_MIN);

function clampEase(ease: number, cfg: SrsConfig): number {
  return Math.max(cfg.minEase, Math.round(ease * 100) / 100);
}

// Day-interval finisher: clamp to [1, max], apply ±fuzz. `rand` in [0,1); 0.5 = no fuzz.
function finalizeIntervalDays(days: number, cfg: SrsConfig, rand: () => number): number {
  let d = Math.min(cfg.maxIntervalDays, Math.max(1, days));
  const fuzz = 1 + (rand() * 2 - 1) * cfg.fuzzPct;
  d = Math.min(cfg.maxIntervalDays, Math.max(1, Math.round(d * fuzz)));
  return d;
}

// Core SM-2 transition. Returns a NEW card; never mutates.
export function scheduleCard(
  card: VocabCard,
  grade: VocabGrade,
  now: Date,
  cfg: SrsConfig = DEFAULT_SRS_CONFIG,
  rand: () => number = Math.random,
): VocabCard {
  const next: VocabCard = { ...card, reps: card.reps + 1 };

  const steps = card.state === 'relearning' ? cfg.relearningStepsMin : cfg.learningStepsMin;

  if (card.state === 'new' || card.state === 'learning' || card.state === 'relearning') {
    const inRelearn = card.state === 'relearning';
    if (grade === 'again') {
      next.state = inRelearn ? 'relearning' : 'learning';
      next.stepIndex = 0;
      next.due = addMinutes(now, steps[0]).toISOString();
    } else if (grade === 'hard') {
      // Simplification of Anki (which averages the first two steps): repeat the current step.
      next.state = inRelearn ? 'relearning' : 'learning';
      next.stepIndex = Math.min(card.state === 'new' ? 0 : card.stepIndex, steps.length - 1);
      next.due = addMinutes(now, steps[next.stepIndex]).toISOString();
    } else if (grade === 'easy') {
      // Skip remaining steps. Learning: fixed easy interval. Relearning: restored interval.
      next.state = 'review';
      next.stepIndex = 0;
      next.intervalDays = inRelearn
        ? finalizeIntervalDays(card.intervalDays, cfg, rand)
        : finalizeIntervalDays(cfg.easyIntervalDays, cfg, rand);
      next.due = addMinutes(now, next.intervalDays * MIN_PER_DAY).toISOString();
    } else {
      // good — advance a step, or graduate past the last one. A new card sits AT step 0,
      // so Good moves it to step 1 (Anki: fresh card's Good button shows the second step;
      // with a single-step config Good graduates immediately).
      const idx = (card.state === 'new' ? 0 : card.stepIndex) + 1;
      if (idx < steps.length) {
        next.state = inRelearn ? 'relearning' : 'learning';
        next.stepIndex = idx;
        next.due = addMinutes(now, steps[idx]).toISOString();
      } else {
        next.state = 'review';
        next.stepIndex = 0;
        // Relearning re-graduates at the (lapse-reduced) stored interval.
        next.intervalDays = inRelearn
          ? finalizeIntervalDays(card.intervalDays, cfg, rand)
          : finalizeIntervalDays(cfg.graduatingIntervalDays, cfg, rand);
        next.due = addMinutes(now, next.intervalDays * MIN_PER_DAY).toISOString();
      }
    }
    return next;
  }

  // state === 'review'
  if (grade === 'again') {
    next.state = 'relearning';
    next.stepIndex = 0;
    next.lapses = card.lapses + 1;
    next.ease = clampEase(card.ease + cfg.againEaseDelta, cfg);
    // The interval the card will return to after relearning.
    next.intervalDays = Math.max(
      cfg.lapseMinIntervalDays,
      Math.round(card.intervalDays * cfg.lapseIntervalFactor),
    );
    next.due = addMinutes(now, cfg.relearningStepsMin[0]).toISOString();
    return next;
  }

  let rawDays: number;
  if (grade === 'hard') {
    next.ease = clampEase(card.ease + cfg.hardEaseDelta, cfg);
    rawDays = card.intervalDays * cfg.hardIntervalFactor;
  } else if (grade === 'easy') {
    next.ease = clampEase(card.ease + cfg.easyEaseDelta, cfg);
    rawDays = card.intervalDays * card.ease * cfg.easyBonus;
  } else {
    rawDays = card.intervalDays * card.ease;
  }
  // Anki guarantee: a successful review is always at least 1 day longer than the last.
  rawDays = Math.max(rawDays, card.intervalDays + 1);
  next.intervalDays = finalizeIntervalDays(rawDays, cfg, rand);
  next.due = addMinutes(now, next.intervalDays * MIN_PER_DAY).toISOString();
  return next;
}

// Human label for an interval given in minutes: '1m' '10m' '3h' '1d' '3d' '2mo' '1yr'
export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  if (minutes < MIN_PER_DAY) return `${Math.round(minutes / 60)}h`;
  const days = minutes / MIN_PER_DAY;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}yr`;
}

// Grade-bar labels ('1m · 10m · 1d · 4d' for a fresh card). Deterministic — no fuzz.
export function previewIntervals(
  card: VocabCard,
  now: Date,
  cfg: SrsConfig = DEFAULT_SRS_CONFIG,
): Record<VocabGrade, string> {
  const noFuzz = () => 0.5;
  const out = {} as Record<VocabGrade, string>;
  for (const g of ['again', 'hard', 'good', 'easy'] as VocabGrade[]) {
    const next = scheduleCard(card, g, now, { ...cfg, fuzzPct: 0 }, noFuzz);
    const minutes = (new Date(next.due).getTime() - now.getTime()) / MS_PER_MIN;
    out[g] = formatInterval(minutes);
  }
  return out;
}

export function isDue(card: VocabCard, now: Date): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

function endOfLocalDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Home/deck badges: new = untouched; learning = learning/relearning due by end of today;
// due = review cards due now (incl. overdue).
export function countsByState(
  cards: VocabCard[],
  now: Date,
): { newCount: number; learning: number; due: number } {
  const eod = endOfLocalDay(now);
  let newCount = 0, learning = 0, due = 0;
  for (const c of cards) {
    if (c.state === 'new') newCount++;
    else if (c.state === 'learning' || c.state === 'relearning') {
      if (new Date(c.due) <= eod) learning++;
    } else if (isDue(c, now)) due++;
  }
  return { newCount, learning, due };
}

// Records from today's log — used to enforce the daily caps across sessions.
export function todaysLog(log: VocabReviewRecord[], now: Date): VocabReviewRecord[] {
  return log.filter((r) => isSameLocalDay(new Date(r.at), now));
}

// Build a session queue: due reviews (by due asc, capped) → due learning/relearning
// (by due asc) → new cards (insertion order, capped). One card per note (sibling bury),
// and — like Anki's bury-siblings default — a note whose OTHER direction was already
// introduced today does not surface its sibling as a new card until tomorrow. Without
// the day-level bury, every fresh visit re-served the same words flipped to their
// other direction, which read as "it isn't recording my reviews".
export function buildQueue(
  cards: VocabCard[],
  now: Date,
  cfg: SrsConfig = DEFAULT_SRS_CONFIG,
  todayLog: VocabReviewRecord[] = [],
): VocabCard[] {
  const byDue = (a: VocabCard, b: VocabCard) => new Date(a.due).getTime() - new Date(b.due).getTime();

  const reviewsDoneToday = todayLog.filter((r) => r.prevState === 'review').length;
  const newIntroducedToday = todayLog.filter((r) => r.prevState === 'new').length;
  const reviewBudget = Math.max(0, cfg.reviewsPerDay - reviewsDoneToday);
  const newBudget = Math.max(0, cfg.newPerDay - newIntroducedToday);
  const notesTouchedToday = new Set(todayLog.map((r) => r.noteId));

  const reviews = cards.filter((c) => c.state === 'review' && isDue(c, now)).sort(byDue).slice(0, reviewBudget);
  const learning = cards.filter((c) => (c.state === 'learning' || c.state === 'relearning') && isDue(c, now)).sort(byDue);
  const fresh = cards
    .filter((c) => c.state === 'new' && !notesTouchedToday.has(c.noteId))
    .slice(0, newBudget);

  const queue: VocabCard[] = [];
  const seenNotes = new Set<string>();
  for (const c of [...reviews, ...learning, ...fresh]) {
    if (seenNotes.has(c.noteId)) continue; // bury sibling
    seenNotes.add(c.noteId);
    queue.push(c);
  }
  return queue;
}

// Remaining new-card allowance for today — the dashboard must advertise this, not
// the raw new-card inventory, or "Today's review: 20" never shrinks as you review.
export function remainingNewBudget(cfg: SrsConfig, todayLog: VocabReviewRecord[]): number {
  return Math.max(0, cfg.newPerDay - todayLog.filter((r) => r.prevState === 'new').length);
}

// Where to splice a re-queued (still-learning) card back into the remaining queue.
// Cards already waiting — including untouched new ones — are "due now" and go first:
// re-showing a just-failed card back-to-back has no spacing value when alternatives
// exist. (The old new-cards-last rule put failed cards at index 0 on fresh decks,
// which both re-showed the same card immediately AND caused the mid-grade "flash":
// the next card rendered, then the async requeue snapped the UI back.) Placement is
// due-ordered among later-due learning cards, clamped to a window so long sessions
// still bring the card back soon, floored at 1 so it is never the immediate next.
const REQUEUE_MAX_AHEAD = 8;

export function requeueIndex(queue: VocabCard[], card: VocabCard): number {
  const cardDue = new Date(card.due).getTime();
  let i = 0;
  for (; i < queue.length; i++) {
    const q = queue[i];
    if (q.state === 'new') continue; // waiting new cards stay ahead of the step timer
    if (new Date(q.due).getTime() > cardDue) break;
  }
  return Math.max(Math.min(i, REQUEUE_MAX_AHEAD), Math.min(1, queue.length));
}

// Which directions a deck setting allows.
export function allowedDirections(setting: DeckDirectionSetting): VocabDirection[] {
  if (setting === 'recognize') return ['recognize'];
  if (setting === 'recall') return ['recall'];
  return ['recognize', 'recall'];
}

export function createCardsForNote(
  noteId: string,
  now: Date,
  cfg: SrsConfig = DEFAULT_SRS_CONFIG,
): VocabCard[] {
  const mk = (direction: VocabDirection): VocabCard => ({
    id: `${noteId}:${direction}`,
    noteId,
    direction,
    state: 'new' as VocabCardState,
    due: now.toISOString(),
    intervalDays: 0,
    ease: cfg.startingEase,
    reps: 0,
    lapses: 0,
    stepIndex: 0,
  });
  // Always create both siblings; deck.direction filters at queue-build time, so the
  // learner can flip the deck setting later without losing scheduling history.
  return [mk('recognize'), mk('recall')];
}
