'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandBar } from '@/components/ui/top-nav';
import { Icons } from '@/components/ui/icons';
import { useAppStore } from '@/lib/store';

export default function OnboardingPage() {
  const router = useRouter();
  const setProfile = useAppStore((s) => s.setProfile);
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setProfile({ name: trimmed });
    router.push('/level-test');
  };

  return (
    <>
      <BrandBar label="01 Getting started" />
      <div className="page-narrow fade-in" style={{ display: 'flex', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '0 0 80px' }}>

          <span className="eyebrow eyebrow-warm" style={{ display: 'block', marginBottom: 20 }}>
            Before we begin
          </span>

          <h1 className="ty-h1" style={{ marginBottom: 16 }}>
            What should we call you?
          </h1>
          <p className="lede" style={{ marginBottom: 48 }}>
            We&rsquo;ll use this to personalise your lessons and track your progress over time.
          </p>

          <form onSubmit={handleSubmit} className="col gap-4">
            <div className="col gap-2">
              <label className="label" htmlFor="name">Your name</label>
              <input
                id="name"
                className="input"
                type="text"
                placeholder="e.g. Mateo"
                autoFocus
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ fontSize: 18, padding: '14px 16px' }}
              />
            </div>

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={!name.trim()}
              style={{ marginTop: 8 }}
            >
              Start level test <Icons.arrow />
            </button>
          </form>

          <p className="small" style={{ marginTop: 24, color: 'var(--mute-2)' }}>
            The test takes about 5 minutes and helps us build your first lesson plan.
          </p>
        </div>
      </div>
    </>
  );
}
