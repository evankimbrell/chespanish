import { describe, it, expect } from 'vitest';
import { verifyCode, verifyCookie, cookieValueFor, isExemptPath, sha256Hex } from './gate';

describe('verifyCode', () => {
  it('accepts the exact code and rejects everything else', () => {
    expect(verifyCode('mate2026', 'mate2026')).toBe(true);
    expect(verifyCode('mate2026 ', 'mate2026')).toBe(false);
    expect(verifyCode('wrong', 'mate2026')).toBe(false);
    expect(verifyCode('', 'mate2026')).toBe(false);
    expect(verifyCode(null, 'mate2026')).toBe(false);
    expect(verifyCode(undefined, 'mate2026')).toBe(false);
  });
});

describe('verifyCookie / cookieValueFor', () => {
  it('round-trips: the cookie value for a code verifies against that code', () => {
    const cookie = cookieValueFor('mate2026');
    expect(cookie).toBe(sha256Hex('mate2026'));
    expect(verifyCookie(cookie, 'mate2026')).toBe(true);
  });
  it('rejects stale cookies after a code rotation and garbage values', () => {
    expect(verifyCookie(cookieValueFor('old-code'), 'new-code')).toBe(false);
    expect(verifyCookie('deadbeef', 'mate2026')).toBe(false);
    expect(verifyCookie(null, 'mate2026')).toBe(false);
  });
});

describe('isExemptPath', () => {
  it('exempts exactly the gate, its API, and health', () => {
    expect(isExemptPath('/gate')).toBe(true);
    expect(isExemptPath('/api/gate')).toBe(true);
    expect(isExemptPath('/api/health')).toBe(true);
    expect(isExemptPath('/favicon.ico')).toBe(true);
  });
  it('gates everything else, including lookalikes', () => {
    expect(isExemptPath('/')).toBe(false);
    expect(isExemptPath('/api/lesson/audio')).toBe(false);
    expect(isExemptPath('/lessons/x.mp3')).toBe(false);
    expect(isExemptPath('/gate2')).toBe(false);
    expect(isExemptPath('/api/gatecrash')).toBe(false);
    expect(isExemptPath('/api/healthcheck')).toBe(false);
  });
});
