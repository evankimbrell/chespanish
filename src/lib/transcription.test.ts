import { describe, it, expect, afterEach } from 'vitest';
import { scribeWordsToTimings, scribeDurationSec, resolveProvider } from './transcription';

const ORIGINAL = process.env.TRANSCRIBE_PROVIDER;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TRANSCRIBE_PROVIDER;
  else process.env.TRANSCRIBE_PROVIDER = ORIGINAL;
});

describe('scribeWordsToTimings', () => {
  it('keeps only spoken words, dropping spacing and audio events', () => {
    const words = [
      { text: 'Hoy', start: 0.1, end: 0.4, type: 'word' },
      { text: ' ', start: 0.4, end: 0.5, type: 'spacing' },
      { text: 'no', start: 0.5, end: 0.7, type: 'word' },
      { text: '(laughter)', start: 0.7, end: 1.2, type: 'audio_event' },
      { text: 'puedo', start: 1.2, end: 1.7, type: 'word' },
    ];
    expect(scribeWordsToTimings(words)).toEqual([
      { word: 'Hoy', start: 0.1, end: 0.4 },
      { word: 'no', start: 0.5, end: 0.7 },
      { word: 'puedo', start: 1.2, end: 1.7 },
    ]);
  });

  it('treats entries with no type as words (defensive default)', () => {
    expect(scribeWordsToTimings([{ text: 'dale', start: 0, end: 0.3 }])).toEqual([
      { word: 'dale', start: 0, end: 0.3 },
    ]);
  });

  it('drops entries missing timestamps or text', () => {
    const words = [
      { text: 'ok', type: 'word' },                       // no timestamps
      { text: '  ', start: 0, end: 0.2, type: 'word' },   // blank text
      { text: 'sí', start: 0.3, end: 0.5, type: 'word' },
    ];
    expect(scribeWordsToTimings(words)).toEqual([{ word: 'sí', start: 0.3, end: 0.5 }]);
  });

  it('is safe on null/undefined/non-array', () => {
    expect(scribeWordsToTimings(null)).toEqual([]);
    expect(scribeWordsToTimings(undefined)).toEqual([]);
  });
});

describe('scribeDurationSec', () => {
  it('uses the max end across ALL entries, including trailing spacing', () => {
    const words = [
      { text: 'Hoy', start: 0.1, end: 0.4, type: 'word' },
      { text: ' ', start: 0.4, end: 2.1, type: 'spacing' }, // trailing silence
    ];
    expect(scribeDurationSec(words)).toBe(2.1);
  });
  it('returns 0 for empty/missing input', () => {
    expect(scribeDurationSec([])).toBe(0);
    expect(scribeDurationSec(null)).toBe(0);
  });
});

describe('resolveProvider', () => {
  it('defaults to whisper when nothing is set', () => {
    delete process.env.TRANSCRIBE_PROVIDER;
    expect(resolveProvider()).toBe('whisper');
  });
  it('reads TRANSCRIBE_PROVIDER=elevenlabs', () => {
    process.env.TRANSCRIBE_PROVIDER = 'elevenlabs';
    expect(resolveProvider()).toBe('elevenlabs');
  });
  it('explicit argument wins over the env', () => {
    process.env.TRANSCRIBE_PROVIDER = 'whisper';
    expect(resolveProvider('elevenlabs')).toBe('elevenlabs');
  });
  it('falls back to whisper on unknown values', () => {
    process.env.TRANSCRIBE_PROVIDER = 'deepgram';
    expect(resolveProvider()).toBe('whisper');
    expect(resolveProvider('nonsense')).toBe('whisper');
  });
});
