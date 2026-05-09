'use client';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',     match: ['/dashboard', '/builder', '/preview', '/player', '/report'] },
  { href: '/lessons',   label: 'Lessons',  match: ['/lessons'] },
  { href: '/mistakes',  label: 'Mistakes', match: ['/mistakes'] },
  { href: '/settings',  label: 'Settings', match: ['/settings'] },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <div className="row gap-3" style={{ cursor: 'pointer', alignItems: 'center' }} onClick={() => router.push('/dashboard')}>
          <span className="brand-mark" />
          <span style={{ fontFamily: 'var(--font-newsreader), serif', fontSize: 19, letterSpacing: '-0.01em' }}>
            Che <em style={{ fontStyle: 'italic', color: 'var(--warm)' }}>Spanish</em>
          </span>
        </div>

        <div className="nav-links">
          {NAV_ITEMS.map((item) => {
            const active = item.match.some((m) => pathname.startsWith(m));
            return (
              <button
                key={item.href}
                className={'nav-link' + (active ? ' active' : '')}
                onClick={() => router.push(item.href)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="row gap-3" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
          <span className="small mono" style={{ color: 'var(--mute-2)' }}>B1 · 12 lessons</span>
          <div className="profile-chip" onClick={() => router.push('/settings')}>
            <span className="avatar">M</span>
            <span className="small">Mateo</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function BrandBar({ label }: { label?: string }) {
  const router = useRouter();
  return (
    <div className="topnav" style={{ borderBottom: 'none', background: 'transparent' }}>
      <div className="topnav-inner" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
        <div className="row gap-3" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>
          <span className="brand-mark" />
          <span style={{ fontFamily: 'var(--font-newsreader), serif', fontSize: 19, letterSpacing: '-0.01em' }}>
            Che <em style={{ fontStyle: 'italic', color: 'var(--warm)' }}>Spanish</em>
          </span>
        </div>
        <span />
        {label && <span className="kicker">{label}</span>}
      </div>
    </div>
  );
}
