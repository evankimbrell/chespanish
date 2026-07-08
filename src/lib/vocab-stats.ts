import type { VocabCard, VocabReviewRecord } from './types';
import { DEFAULT_SRS_CONFIG } from './srs';

// Home-screen statistics, computed from the append-only review log + current card
// states. Pure — callers pass `now`.

export interface RetentionStats {
  maturePct: number | null;  // % of non-Again grades on mature cards (interval ≥ 21d), last 30d
  youngPct: number | null;   // same for young review cards; null when no data in bucket
  streakDays: number;
}

const DAY_MS = 86_400_000;

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function computeRetention(
  log: VocabReviewRecord[],
  now: Date,
  windowDays = 30,
  matureThresholdDays = DEFAULT_SRS_CONFIG.matureThresholdDays,
): RetentionStats {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  let matureTotal = 0, matureCorrect = 0, youngTotal = 0, youngCorrect = 0;
  for (const r of log) {
    if (new Date(r.at).getTime() < cutoff) continue;
    if (r.prevState !== 'review') continue; // retention is a review-card metric
    const correct = r.grade !== 'again';
    if (r.prevIntervalDays >= matureThresholdDays) {
      matureTotal++; if (correct) matureCorrect++;
    } else {
      youngTotal++; if (correct) youngCorrect++;
    }
  }
  return {
    maturePct: matureTotal ? Math.round((matureCorrect / matureTotal) * 100) : null,
    youngPct: youngTotal ? Math.round((youngCorrect / youngTotal) * 100) : null,
    streakDays: computeStreak(log, now),
  };
}

// Consecutive days with ≥1 review, ending today — or ending yesterday if there are no
// reviews yet today (so the streak isn't visually broken before the day's session).
export function computeStreak(log: VocabReviewRecord[], now: Date): number {
  const days = new Set(log.map((r) => localDayKey(new Date(r.at))));
  if (days.size === 0) return 0;
  let cursor = new Date(now);
  if (!days.has(localDayKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!days.has(localDayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(localDayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

// Cards due per local day for the next `days` days. Bucket 0 = today, including
// overdue reviews and due learning cards. Cards due beyond the horizon are excluded.
export function dueForecast(cards: VocabCard[], now: Date, days = 7): number[] {
  const out = new Array<number>(days).fill(0);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  for (const c of cards) {
    if (c.state === 'new') continue; // new cards enter via the daily limit, not the forecast
    const due = new Date(c.due).getTime();
    const dayIdx = Math.floor((due - startOfToday.getTime()) / DAY_MS);
    const bucket = Math.max(0, dayIdx); // overdue → today
    if (bucket < days) out[bucket]++;
  }
  return out;
}

// Rough session length: ~12.5s per card, ceil to minutes (mock shows "43 cards, ~9 min").
export function estimateMinutes(totalCards: number): number {
  return Math.ceil((totalCards * 12.5) / 60);
}
