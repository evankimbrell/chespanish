import { createHash, timingSafeEqual } from 'crypto';

// Shared-passcode gate helpers (pure; used by src/proxy.ts and /api/gate).
// One ACCESS_CODE for the whole app — right-sized for a handful of trusted users.
// The cookie stores sha256(code) so the code itself never sits in the jar, and all
// comparisons go through timingSafeEqual on fixed-length digests.

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function digestsEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a, 'utf8').digest();
  const db = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(da, db);
}

// The value stored in the che_gate cookie for a given access code.
export function cookieValueFor(accessCode: string): string {
  return sha256Hex(accessCode);
}

// Plaintext code presented via the /gate form or the x-access-code header.
export function verifyCode(presented: string | null | undefined, accessCode: string): boolean {
  if (!presented) return false;
  return digestsEqual(presented, accessCode);
}

// Cookie value presented on a request.
export function verifyCookie(cookieValue: string | null | undefined, accessCode: string): boolean {
  if (!cookieValue) return false;
  return digestsEqual(cookieValue, cookieValueFor(accessCode));
}

// Paths that must work without the gate: the gate itself, and the health check
// (Fly's prober carries no cookies). Everything else — pages, API, media — is gated.
export function isExemptPath(pathname: string): boolean {
  return (
    pathname === '/gate' ||
    pathname === '/api/gate' ||
    pathname === '/api/health' ||
    pathname === '/favicon.ico'
  );
}

export const GATE_COOKIE = 'che_gate';
