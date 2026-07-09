import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, isExemptPath, verifyCode, verifyCookie } from '@/lib/gate';

// Access gate for the deployed app (Next 16 proxy — the renamed middleware
// convention; runs on the Node runtime). Every page, API route, and media file
// requires either the che_gate cookie (set by /gate) or an x-access-code header
// (used by curl smoke tests and the test-runner's server-to-self fetches).
// With ACCESS_CODE unset (local dev) the gate is wide open.

export function proxy(request: NextRequest) {
  const accessCode = process.env.ACCESS_CODE?.trim();
  if (!accessCode) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isExemptPath(pathname)) return NextResponse.next();

  if (verifyCookie(request.cookies.get(GATE_COOKIE)?.value, accessCode)) return NextResponse.next();
  if (verifyCode(request.headers.get('x-access-code'), accessCode)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'access_code_required' }, { status: 401 });
  }
  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = '/gate';
  gateUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(gateUrl, 307);
}

export const config = {
  // Static build assets are unauthenticated (hashed names, no user data); everything
  // else flows through the gate check above.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
