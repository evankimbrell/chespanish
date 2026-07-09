import { describe, it, expect } from 'vitest';
import path from 'path';
import { resolveDataDir, DATA_DIR, MEDIA_LESSONS_DIR, VOCAB_DIR } from './data-paths';

describe('resolveDataDir', () => {
  it('defaults to <cwd>/data when DATA_DIR is unset or blank', () => {
    expect(resolveDataDir({})).toBe(path.join(process.cwd(), 'data'));
    expect(resolveDataDir({ DATA_DIR: '  ' })).toBe(path.join(process.cwd(), 'data'));
  });
  it('resolves an explicit DATA_DIR to an absolute path', () => {
    expect(resolveDataDir({ DATA_DIR: '/data' })).toBe('/data');
    expect(resolveDataDir({ DATA_DIR: 'relative/dir' })).toBe(path.resolve('relative/dir'));
  });
  it('exports subdirs rooted under DATA_DIR', () => {
    expect(VOCAB_DIR).toBe(path.join(DATA_DIR, 'vocab'));
    expect(MEDIA_LESSONS_DIR).toBe(path.join(DATA_DIR, 'media', 'lessons'));
  });
});
