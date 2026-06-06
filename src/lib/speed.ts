// Playback speed for the SPANISH voices only (the narrator is always 1×). ElevenLabs
// supports voice_settings.speed in the 0.7–1.2 range, so a speed change means
// regenerating the affected audio chunk. These helpers are pure so the cycling /
// "does this chunk need regenerating" logic can be unit-tested.

export const SPANISH_SPEEDS = [1.2, 1.1, 1.0, 0.9, 0.8, 0.7] as const;
export const DEFAULT_SPANISH_SPEED = 1.0;
export const MIN_SPEED = 0.7;
export const MAX_SPEED = 1.2;

export function clampSpeed(s: number): number {
  if (!Number.isFinite(s)) return DEFAULT_SPANISH_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(s * 10) / 10));
}

export function formatSpeed(s: number): string {
  // `${1.0}` → "1", `${0.9}` → "0.9" — exactly the display we want.
  return `${s}×`;
}

// A play needs its audio regenerated when its Spanish content was rendered at a
// different speed than the one now selected. Narrator-only plays (no Spanish) are
// unaffected by speed, so they never need regeneration.
export function playNeedsRegen(
  play: { hasSpanish?: boolean; speed?: number } | undefined | null,
  targetSpeed: number,
): boolean {
  if (!play || !play.hasSpanish) return false;
  return (play.speed ?? DEFAULT_SPANISH_SPEED) !== targetSpeed;
}
