'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';
import type { ComfortLevel } from '@/lib/types';

const COMFORT_OPTIONS: { value: ComfortLevel; label: string }[] = [
  { value: 0, label: "I'm brand new" },
  { value: 1, label: 'I know a few words and phrases' },
  { value: 2, label: "I've studied a little" },
  { value: 3, label: 'I can handle basic conversations' },
  { value: 4, label: "I'm pretty comfortable" },
  { value: 5, label: "I'm advanced and want refinement" },
];

function SkippingScreen() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push('/dashboard'), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div
      className="fade-in"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 32px',
        gap: 32,
      }}
    >
      <span className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      <div className="col gap-3" style={{ maxWidth: 480 }}>
        <h2 className="ty-h2">Starting at the beginning.</h2>
        <p className="lede">
          Since you&rsquo;ve never studied Spanish before, we&rsquo;ll start you at the very beginning.
          No need to test your level.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const setProfile = useAppStore((s) => s.setProfile);
  const [name, setName] = useState('');
  const [comfort, setComfort] = useState<ComfortLevel | ''>('');
  const [skipping, setSkipping] = useState(false);

  const canSubmit = name.trim() && comfort !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const level = comfort as ComfortLevel;
    setProfile({ name: name.trim(), comfortLevel: level });

    if (level === 0) {
      setSkipping(true);
    } else {
      router.push('/level-test');
    }
  };

  if (skipping) return <SkippingScreen />;

  return (
    <>
      <BrandBar label="01 Getting started" />
      <div
        className="page-narrow fade-in"
        style={{ display: 'flex', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}
      >
        <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '0 0 80px' }}>
          <span className="eyebrow eyebrow-warm" style={{ display: 'block', marginBottom: 20 }}>
            Before we begin
          </span>

          <h1 className="ty-h1" style={{ marginBottom: 16 }}>
            Tell us about yourself.
          </h1>
          <p className="lede" style={{ marginBottom: 48 }}>
            We&rsquo;ll personalise your lessons and track your progress over time.
          </p>

          <form onSubmit={handleSubmit} className="col gap-5">
            <div className="col gap-2">
              <label className="label" htmlFor="name">Your name</label>
              <input
                id="name"
                className="input"
                type="text"
                placeholder="e.g. Evan"
                autoFocus
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ fontSize: 18, padding: '14px 16px' }}
              />
            </div>

            <div className="col gap-2">
              <label className="label" htmlFor="comfort">How comfortable are you with Spanish?</label>
              <select
                id="comfort"
                className="select-field"
                value={comfort}
                onChange={(e) => setComfort(e.target.value === '' ? '' : Number(e.target.value) as ComfortLevel)}
                style={{ fontSize: 15, padding: '14px 16px', height: 'auto' }}
              >
                <option value="" disabled>Select your level…</option>
                {COMFORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={!canSubmit}
              style={{ marginTop: 8 }}
            >
              {comfort === 0 ? 'Get started' : 'Start level test'} <Icons.arrow />
            </button>
          </form>

          <p className="small" style={{ marginTop: 24, color: 'var(--mute-2)' }}>
            {comfort === 0
              ? "We'll place you at the beginning — no test needed."
              : 'The level test takes about 5 minutes and helps us build your first lesson plan.'}
          </p>
        </div>
      </div>
    </>
  );
}
