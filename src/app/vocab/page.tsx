'use client';
import { useCallback, useEffect, useState } from 'react';
import { TopNav } from '@/components/ui/top-nav';
import { useAppStore } from '@/lib/store';
import type { VocabHomePayload, SessionResult } from './vocab-shared';
import { VocabSetup } from './vocab-setup';
import { VocabHome } from './vocab-home';
import { VocabReview } from './vocab-review';
import { VocabSummary } from './vocab-summary';

type Mode = 'loading' | 'setup' | 'home' | 'review' | 'summary';

// Vocab section: SRS flashcards (setup → home → review → summary). Setup-completed
// lives server-side in the user's vocab store (profiles switch), not localStorage.
export default function VocabPage() {
  const userName = useAppStore((s) => s.profile.name);
  const [mode, setMode] = useState<Mode>('loading');
  const [home, setHome] = useState<VocabHomePayload | null>(null);
  const [reviewScope, setReviewScope] = useState<string>('all');
  const [results, setResults] = useState<SessionResult[]>([]);

  const reload = useCallback(async (nextMode?: Mode) => {
    try {
      // tz: day-bucketed stats (streak, daily budget, forecast) follow THIS device's
      // clock — the server runs in UTC and would flip "today" mid-evening.
      const res = await fetch(`/api/vocab?user=${encodeURIComponent(userName)}&tz=${new Date().getTimezoneOffset()}`);
      const data: VocabHomePayload = await res.json();
      setHome(data);
      setMode(nextMode ?? (data.setupCompleted ? 'home' : 'setup'));
    } catch {
      // Only the initial load falls back to setup; a failed background refresh
      // must not yank the user off the screen they're on.
      setMode((m) => (m === 'loading' ? 'setup' : m));
    }
  }, [userName]);

  useEffect(() => { setMode('loading'); reload(); }, [reload]);

  const startReview = (scope: string) => { setReviewScope(scope); setMode('review'); };
  // Switch to the summary IMMEDIATELY — reload used to flip the mode only after the
  // home refetch, so the review's empty state flashed for the fetch duration.
  const finishReview = (r: SessionResult[]) => { setResults(r); setMode('summary'); reload('summary'); };

  return (
    <>
      <TopNav />
      {mode === 'loading' && (
        <div className="page fade-in" style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      )}
      {mode === 'setup' && (
        <VocabSetup
          userName={userName}
          hasDecks={(home?.decks.length ?? 0) > 0}
          onDone={() => reload('home')}
          onBack={home?.setupCompleted ? () => setMode('home') : undefined}
        />
      )}
      {mode === 'home' && home && (
        <VocabHome
          data={home}
          onReview={startReview}
          onAddDeck={() => setMode('setup')}
          onDeleteDeck={async (deckId) => {
            await fetch('/api/vocab', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user: userName, op: 'delete-deck', deckId }),
            }).catch(() => {});
            reload('home');
          }}
        />
      )}
      {mode === 'review' && (
        <VocabReview
          userName={userName}
          scope={reviewScope}
          onExit={() => reload('home')}
          onFinish={finishReview}
        />
      )}
      {mode === 'summary' && (
        <VocabSummary
          userName={userName}
          results={results}
          onHome={() => setMode('home')}
        />
      )}
    </>
  );
}
