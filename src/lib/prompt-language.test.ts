import { describe, it, expect } from 'vitest';
import { expectsEnglishResponse } from './prompt-language';

describe('expectsEnglishResponse', () => {
  it('detects an explicit English-answer instruction', () => {
    expect(expectsEnglishResponse('Listen to the conversation. In English, tell me why he can\'t meet today.')).toBe(true);
    expect(expectsEnglishResponse('Now answer in English.')).toBe(true);
    expect(expectsEnglishResponse('Respond in English with what he said.')).toBe(true);
  });

  it('detects the Spanish-phrased instruction "en inglés" (with or without accent)', () => {
    expect(expectsEnglishResponse('Respondé en inglés qué dijo.')).toBe(true);
    expect(expectsEnglishResponse('Responde en ingles.')).toBe(true);
  });

  it('returns false for normal Spanish-response prompts', () => {
    expect(expectsEnglishResponse('Decí que no podés hoy pero sí mañana.')).toBe(false);
    expect(expectsEnglishResponse('Ask what time they want to meet.')).toBe(false);
    expect(expectsEnglishResponse('¿Cómo se dice "mañana"?')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(expectsEnglishResponse('IN ENGLISH, SUMMARIZE THE CALL.')).toBe(true);
  });

  it('handles empty / missing text', () => {
    expect(expectsEnglishResponse('')).toBe(false);
    expect(expectsEnglishResponse(undefined)).toBe(false);
    expect(expectsEnglishResponse(null)).toBe(false);
  });

  it('does not fire on the bare word "english" without the "in" directive', () => {
    // avoids false positives like a vocab note mentioning the language in passing
    expect(expectsEnglishResponse('The English word is "tired".')).toBe(false);
  });
});
