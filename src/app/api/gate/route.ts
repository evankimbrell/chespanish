import { cookieValueFor, verifyCode, GATE_COOKIE } from '@/lib/gate';

// POST /api/gate — the /gate form target. Verifies the shared passcode and sets
// the year-long gate cookie. Exempt from the proxy gate (it IS the gate).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Only allow relative in-app targets so ?next= can't bounce users off-site.
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

// Relative Location on purpose: the standalone server derives req.url's origin
// from its bind HOSTNAME (0.0.0.0), not the public host, so absolute URLs here
// would point nowhere behind Fly's proxy. Browsers resolve relative fine.
const redirect = (location: string, headers: Record<string, string> = {}) =>
  new Response(null, { status: 303, headers: { Location: location, ...headers } });

export async function POST(req: Request) {
  const accessCode = process.env.ACCESS_CODE?.trim();
  const form = await req.formData();
  const code = String(form.get('code') ?? '');
  const next = safeNext(form.get('next') as string | null);

  if (!accessCode) return redirect(next);

  if (!verifyCode(code, accessCode)) {
    await sleep(500); // cheap brute-force damper
    return redirect(`/gate?error=1&next=${encodeURIComponent(next)}`);
  }

  // Secure only when the edge saw HTTPS (Fly sets x-forwarded-proto); the local
  // prod rehearsal runs plain http and still needs the cookie to stick.
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  const secure = proto === 'https' ? '; Secure' : '';
  return redirect(next, {
    'Set-Cookie': `${GATE_COOKIE}=${cookieValueFor(accessCode)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=31536000`,
  });
}
