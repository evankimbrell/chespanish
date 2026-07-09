import { describe, it, expect } from 'vitest';
import { isSafeMediaName, contentTypeFor, parseRange } from './media-files';

describe('isSafeMediaName', () => {
  it('accepts generated filename shapes', () => {
    expect(isSafeMediaName('evan-1778886234700-12.mp3')).toBe(true);
    expect(isSafeMediaName('evan-1778886234700-12-s07.mp3')).toBe(true);
    expect(isSafeMediaName('el-colectivo.a1B2.png')).toBe(true);
  });
  it('rejects traversal, separators, dotfiles, and unknown extensions', () => {
    expect(isSafeMediaName('../secrets.mp3')).toBe(false);
    expect(isSafeMediaName('a/b.mp3')).toBe(false);
    expect(isSafeMediaName('a\\b.mp3')).toBe(false);
    expect(isSafeMediaName('.htaccess')).toBe(false);
    expect(isSafeMediaName('x..y.mp3')).toBe(false);
    expect(isSafeMediaName('run.sh')).toBe(false);
    expect(isSafeMediaName('')).toBe(false);
  });
});

describe('contentTypeFor', () => {
  it('maps known extensions', () => {
    expect(contentTypeFor('a.mp3')).toBe('audio/mpeg');
    expect(contentTypeFor('a.PNG')).toBe('image/png');
    expect(contentTypeFor('a.webp')).toBe('image/webp');
  });
});

describe('parseRange', () => {
  it('returns null when absent or malformed (serve full 200)', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=-', 100)).toBeNull();
    expect(parseRange('items=0-1', 100)).toBeNull();
    expect(parseRange('bytes=0-1,5-6', 100)).toBeNull(); // multi-range → full response
  });
  it('parses start-end, open-ended, and suffix ranges', () => {
    expect(parseRange('bytes=0-1', 100)).toEqual({ start: 0, end: 1 });
    expect(parseRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
    expect(parseRange('bytes=90-150', 100)).toEqual({ start: 90, end: 99 }); // end clamped
  });
  it('flags unsatisfiable ranges (416)', () => {
    expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=5-2', 100)).toBe('unsatisfiable');
  });
});
