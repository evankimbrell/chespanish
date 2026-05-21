'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',     match: ['/dashboard', '/builder', '/preview', '/player', '/report'] },
  { href: '/lessons',   label: 'Lessons',  match: ['/lessons'] },
  { href: '/mistakes',  label: 'Mistakes', match: ['/mistakes'] },
  { href: '/settings',  label: 'Settings', match: ['/settings'] },
];

interface ProfileEntry { name: string; level: string }

function ProfileSwitcher() {
  const { name, level } = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const initial = name.charAt(0).toUpperCase();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/debug/profiles')
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="profile-chip" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{initial}</span>
        <span className="small">{name}</span>
      </div>

      {open && profiles.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-2)', border: '1px solid var(--line)',
          borderRadius: 6, minWidth: 180, zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--line)' }}>
            <span className="eyebrow" style={{ fontSize: 10 }}>Switch profile</span>
          </div>
          {profiles.map((p) => {
            const active = p.name.toLowerCase() === name.toLowerCase();
            return (
              <button
                key={p.name}
                onClick={() => {
                  setProfile({ name: p.name, level: p.level });
                  setOpen(false);
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: active ? 'var(--bg-3, rgba(255,255,255,.06))' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span className="avatar" style={{ width: 26, height: 26, fontSize: 12, flexShrink: 0, background: active ? 'var(--warm)' : 'var(--ink-3, #444)', color: active ? '#100e0c' : 'var(--ink)' }}>
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="small" style={{ color: 'var(--ink)', fontWeight: active ? 600 : 400 }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 1 }}>{p.level}</div>
                </div>
                {active && <span style={{ fontSize: 10, color: 'var(--warm)' }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { level, lessonsCompleted } = useAppStore((s) => s.profile);

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
          <span className="small mono" style={{ color: 'var(--mute-2)' }}>{level} · {lessonsCompleted} lessons</span>
          <ProfileSwitcher />
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
