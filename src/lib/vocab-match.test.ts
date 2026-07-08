import { describe, it, expect } from 'vitest';
import { normalizeSpanish, matchesAnswer } from './vocab-match';

describe('normalizeSpanish', () => {
  it('lowercases, strips accents and punctuation, collapses whitespace', () => {
    expect(normalizeSpanish('  ¿Qué  ONDA?! ')).toBe('que onda');
    expect(normalizeSpanish('café')).toBe('cafe');
  });
  it('strips ñ symmetrically', () => {
    expect(normalizeSpanish('mañana')).toBe('manana');
  });
});

describe('matchesAnswer', () => {
  it('matches exact and accent-insensitive answers', () => {
    expect(matchesAnswer('el colectivo', 'el colectivo')).toBe(true);
    expect(matchesAnswer('el colectívo', 'el colectivo')).toBe(true);
    expect(matchesAnswer('MANANA', 'mañana')).toBe(true);
  });
  it('tolerates a leading article on either side', () => {
    expect(matchesAnswer('colectivo', 'el colectivo')).toBe(true);
    expect(matchesAnswer('la heladera', 'heladera')).toBe(true);
    expect(matchesAnswer('una heladera', 'la heladera')).toBe(true);
  });
  it('rejects different words', () => {
    expect(matchesAnswer('el refrigerador', 'la heladera')).toBe(false);
    expect(matchesAnswer('la vereda rota', 'la vereda')).toBe(false);
  });
  it('rejects empty input', () => {
    expect(matchesAnswer('', 'la heladera')).toBe(false);
    expect(matchesAnswer('  ¿?  ', 'la heladera')).toBe(false);
  });
  it('only drops ONE leading article (article-only utterances do not match)', () => {
    expect(matchesAnswer('el', 'el colectivo')).toBe(false);
  });
});
