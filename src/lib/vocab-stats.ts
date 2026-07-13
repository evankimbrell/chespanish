import type { VocabCard, VocabReviewRecord } from './types';
import { DEFAULT_SRS_CONFIG, localDayParts } from './srs';

// Home-screen statistics, computed from the append-only review log + current card
// states. Pure — callers pass `now` (and the client's timezone offset, so "day"
// boundaries follow the user's clock rather than the server's — see srs.ts).

export interface RetentionStats {
  overallPct: number | null; // % of non-Again grades across ALL answers, last 30d
  maturePct: number | null;  // % of non-Again grades on mature cards (interval ≥ 21d), last 30d
  youngPct: number | null;   // same for young review cards; null when no data in bucket
  streakDays: number;
}

const DAY_MS = 86_400_000;

function localDayKey(d: Date, tzOffsetMin?: number): string {
  const [y, m, day] = localDayParts(d, tzOffsetMin);
  return `${y}-${m}-${day}`;
}

// Mature/young retention only counts review-state cards, so both sit at "—" for the
// first weeks of a new collection (nothing has graduated past 21 days). overallPct
// covers every answer — learning steps included — so the card shows real numbers
// from the first session.
export function computeRetention(
  log: VocabReviewRecord[],
  now: Date,
  tzOffsetMin?: number,
  windowDays = 30,
  matureThresholdDays = DEFAULT_SRS_CONFIG.matureThresholdDays,
): RetentionStats {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  let allTotal = 0, allCorrect = 0;
  let matureTotal = 0, matureCorrect = 0, youngTotal = 0, youngCorrect = 0;
  for (const r of log) {
    if (new Date(r.at).getTime() < cutoff) continue;
    const correct = r.grade !== 'again';
    allTotal++; if (correct) allCorrect++;
    if (r.prevState !== 'review') continue; // mature/young are review-card metrics
    if (r.prevIntervalDays >= matureThresholdDays) {
      matureTotal++; if (correct) matureCorrect++;
    } else {
      youngTotal++; if (correct) youngCorrect++;
    }
  }
  return {
    overallPct: allTotal ? Math.round((allCorrect / allTotal) * 100) : null,
    maturePct: matureTotal ? Math.round((matureCorrect / matureTotal) * 100) : null,
    youngPct: youngTotal ? Math.round((youngCorrect / youngTotal) * 100) : null,
    streakDays: computeStreak(log, now, tzOffsetMin),
  };
}

// Consecutive days with ≥1 review, ending today — or ending yesterday if there are no
// reviews yet today (so the streak isn't visually broken before the day's session).
export function computeStreak(log: VocabReviewRecord[], now: Date, tzOffsetMin?: number): number {
  const days = new Set(log.map((r) => localDayKey(new Date(r.at), tzOffsetMin)));
  if (days.size === 0) return 0;
  let cursor = new Date(now);
  if (!days.has(localDayKey(cursor, tzOffsetMin))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!days.has(localDayKey(cursor, tzOffsetMin))) return 0;
  }
  let streak = 0;
  while (days.has(localDayKey(cursor, tzOffsetMin))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

// Cards due per user-local day for the next `days` days. Bucket 0 = today, including
// overdue reviews and due learning cards. Cards due beyond the horizon are excluded.
export function dueForecast(cards: VocabCard[], now: Date, days = 7, tzOffsetMin?: number): number[] {
  const out = new Array<number>(days).fill(0);
  let startOfToday: number;
  if (tzOffsetMin === undefined) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    startOfToday = d.getTime();
  } else {
    const s = new Date(now.getTime() - tzOffsetMin * 60_000);
    s.setUTCHours(0, 0, 0, 0);
    startOfToday = s.getTime() + tzOffsetMin * 60_000;
  }
  for (const c of cards) {
    if (c.state === 'new') continue; // new cards enter via the daily limit, not the forecast
    const due = new Date(c.due).getTime();
    const dayIdx = Math.floor((due - startOfToday) / DAY_MS);
    const bucket = Math.max(0, dayIdx); // overdue → today
    if (bucket < days) out[bucket]++;
  }
  return out;
}

// Rough session length: ~12.5s per card, ceil to minutes (mock shows "43 cards, ~9 min").
export function estimateMinutes(totalCards: number): number {
  return Math.ceil((totalCards * 12.5) / 60);
}
