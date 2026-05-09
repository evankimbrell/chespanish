'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { USER_RESPONSE } from '@/lib/data';

interface UserResponseAnalysisProps {
  target: string;
}

export function UserResponseAnalysis({ target }: UserResponseAnalysisProps) {
  const [explainToken, setExplainToken] = useState<number | null>(null);
  const router = useRouter();
  const tokens = USER_RESPONSE.tokens;
  const tok = explainToken != null ? tokens[explainToken] : null;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="row between" style={{ alignItems: 'baseline', marginBottom: 14 }}>
        <span className="eyebrow">YOU SAID</span>
        <span className="kicker">2 issues · tap a word</span>
      </div>

      <p className="serif" style={{ fontSize: 26, fontStyle: 'italic', lineHeight: 1.4, margin: 0 }}>
        {tokens.map((t, i) => {
          if (t.kind === 'wrong') {
            const isOpen = explainToken === i;
            return (
              <span key={i}>
                <button
                  onClick={() => setExplainToken(isOpen ? null : i)}
                  style={{
                    background: isOpen ? 'rgba(201,112,100,.2)' : 'transparent',
                    color: 'var(--crit)',
                    border: 0, padding: '0 2px',
                    textDecoration: 'underline',
                    textDecorationStyle: 'wavy',
                    textDecorationColor: 'var(--crit)',
                    textUnderlineOffset: '5px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-newsreader), serif',
                    fontStyle: 'italic',
                    fontSize: 'inherit',
                  }}
                >
                  {t.t}
                </button>{' '}
              </span>
            );
          }
          return <span key={i}>{t.t}{i < tokens.length - 1 && t.t !== '¿' ? ' ' : ''}</span>;
        })}
      </p>

      {tok && (
        <div
          className="fade-in"
          style={{
            marginTop: 16, padding: '16px 18px',
            background: 'var(--bg-3)', borderLeft: '2px solid var(--crit)',
            borderRadius: '0 4px 4px 0',
          }}
        >
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <span className="eyebrow" style={{ color: 'var(--crit)' }}>{tok.cat} · &ldquo;{tok.t}&rdquo;</span>
            <button className="btn btn-text small" onClick={() => setExplainToken(null)} style={{ padding: 0 }}>
              <Icons.x />
            </button>
          </div>
          <p className="body" style={{ marginTop: 10, marginBottom: 14, fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', fontSize: 17 }}>
            {tok.issue}
          </p>
          <div className="row gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/mistakes/m1')}>
              <Icons.spark /> Explain it to me
            </button>
            <button className="btn btn-text btn-sm">
              <Icons.play /> Hear it correctly
            </button>
          </div>
        </div>
      )}

      <hr className="divider" style={{ margin: '18px 0' }} />
      <span className="eyebrow eyebrow-warm">TARGET</span>
      <p className="serif" style={{ fontSize: 24, fontStyle: 'italic', marginTop: 8, marginBottom: 0 }}>
        &ldquo;{target}&rdquo;
      </p>
    </div>
  );
}
