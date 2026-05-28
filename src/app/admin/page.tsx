'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserSummary {
  name: string;
  level: string | null;
  hasLevelTest: boolean;
  lessonsStarted: number;
  lessonsCompleted: number;
  lastActiveAt: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <span className="mono small" style={{ color: 'var(--mute)', letterSpacing: '0.08em' }}>DEV TOOL</span>
        <h1 className="serif" style={{ fontSize: 32, margin: '8px 0 4px' }}>Admin · Users</h1>
        <p className="small" style={{ color: 'var(--mute)' }}>
          All users with stored data. Click a user to inspect their full profile.
        </p>
      </div>

      {loading && <p className="small" style={{ color: 'var(--mute)' }}>Loading…</p>}

      {!loading && users.length === 0 && (
        <p className="small" style={{ color: 'var(--mute)' }}>No user data found in data/reports/ or data/lessons/.</p>
      )}

      {users.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
          {users.map((u, i) => (
            <button
              key={u.name}
              onClick={() => router.push(`/admin/${encodeURIComponent(u.name)}`)}
              style={{
                width: '100%', padding: '16px 20px', background: 'var(--bg-2)',
                border: 'none', borderBottom: i < users.length - 1 ? '1px solid var(--line)' : 'none',
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{u.name}</span>
                  {u.level && (
                    <span className="mono" style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 3,
                      background: 'var(--warm)', color: 'var(--bg)', fontWeight: 700,
                    }}>{u.level}</span>
                  )}
                  {!u.hasLevelTest && (
                    <span className="mono small" style={{ color: 'var(--mute)' }}>no level test</span>
                  )}
                </div>
                <span className="small" style={{ color: 'var(--mute)' }}>
                  {u.lessonsStarted} lesson{u.lessonsStarted !== 1 ? 's' : ''} started
                  {u.lessonsCompleted > 0 && ` · ${u.lessonsCompleted} completed`}
                  {u.lastActiveAt && ` · last active ${new Date(u.lastActiveAt).toLocaleDateString()}`}
                </span>
              </div>
              <span className="small" style={{ color: 'var(--warm)', whiteSpace: 'nowrap' }}>View →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
