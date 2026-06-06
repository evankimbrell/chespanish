import { describe, it, expect } from 'vitest';
import { clampSpeed, formatSpeed, playNeedsRegen, SPANISH_SPEEDS, DEFAULT_SPANISH_SPEED } from './speed';

describe('clampSpeed', () => {
  it('keeps in-range values', () => {
    expect(clampSpeed(0.9)).toBe(0.9);
    expect(clampSpeed(1.0)).toBe(1.0);
    expect(clampSpeed(1.2)).toBe(1.2);
  });
  it('clamps to the ElevenLabs 0.7–1.2 range', () => {
    expect(clampSpeed(0.5)).toBe(0.7);
    expect(clampSpeed(2.0)).toBe(1.2);
  });
  it('falls back to default on non-finite input', () => {
    expect(clampSpeed(NaN)).toBe(DEFAULT_SPANISH_SPEED);
  });
});

describe('formatSpeed', () => {
  it('shows whole numbers without a decimal and fractions with one', () => {
    expect(formatSpeed(1.0)).toBe('1×');
    expect(formatSpeed(0.9)).toBe('0.9×');
    expect(formatSpeed(1.2)).toBe('1.2×');
  });
});

describe('SPANISH_SPEEDS', () => {
  it('only contains values ElevenLabs accepts', () => {
    for (const s of SPANISH_SPEEDS) {
      expect(s).toBeGreaterThanOrEqual(0.7);
      expect(s).toBeLessThanOrEqual(1.2);
    }
    expect(SPANISH_SPEEDS).toContain(1.0);
  });
});

describe('playNeedsRegen', () => {
  it('returns false for narrator-only plays (no Spanish, speed-independent)', () => {
    expect(playNeedsRegen({ hasSpanish: false, speed: 1.0 }, 0.8)).toBe(false);
  });
  it('returns true when a Spanish play was rendered at a different speed', () => {
    expect(playNeedsRegen({ hasSpanish: true, speed: 1.0 }, 0.8)).toBe(true);
  });
  it('returns false when a Spanish play already matches the target speed', () => {
    expect(playNeedsRegen({ hasSpanish: true, speed: 0.8 }, 0.8)).toBe(false);
  });
  it('treats a missing speed as the default 1.0', () => {
    expect(playNeedsRegen({ hasSpanish: true }, 1.0)).toBe(false);
    expect(playNeedsRegen({ hasSpanish: true }, 0.9)).toBe(true);
  });
  it('is safe on null/undefined', () => {
    expect(playNeedsRegen(undefined, 0.8)).toBe(false);
    expect(playNeedsRegen(null, 0.8)).toBe(false);
  });
});
