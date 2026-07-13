'use client';
import { SectionHead } from '@/components/ui/section-head';
import { Icons } from '@/components/ui/icons';
import type { VocabHomePayload } from './vocab-shared';

// Vocab home: today's totals, retention + due forecast (real data), deck list.
export function VocabHome({ data, onReview, onAddDeck, onDeleteDeck }: {
  data: VocabHomePayload;
  onReview: (scope: string) => void;
  onAddDeck: () => void;
  onDeleteDeck: (deckId: string) => void;
}) {
  const { totals, decks, forecast, retention } = data;
  const totalToday = totals.due + totals.learning + Math.min(totals.newCount, 20);
  const maxForecast = Math.max(1, ...forecast);
  // Day labels rotated from today's weekday (Spanish two-letter, mock style)
  const dayNames = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sa'];
  const todayIdx = new Date().getDay();

  return (
    <div className="page fade-in">
      {/* Header + big due summary */}
      <div className="row between" style={{ alignItems: 'flex-end', gap: 48, paddingBottom: 32, borderBottom: '1px solid var(--line)', marginBottom: 40 }}>
        <div className="col gap-4" style={{ flex: 1 }}>
          <span className="eyebrow">Vocab · spaced repetition</span>
          <h1 className="ty-h1">
            Today&rsquo;s review:{' '}
            <em style={{ fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', color: 'var(--warm)' }}>
              {totalToday} card{totalToday === 1 ? '' : 's'}
            </em>
            {totalToday > 0 && <>, about {totals.estMinutes} minute{totals.estMinutes === 1 ? '' : 's'}.</>}
            {totalToday === 0 && <> — all caught up.</>}
          </h1>
        </div>
        <div className="row gap-8" style={{ paddingBottom: 6 }}>
          {([['New', Math.min(totals.newCount, 20), 'var(--ink-2)'], ['Learning', totals.learning, 'var(--warm)'], ['Due', totals.due, 'var(--crit)']] as [string, number, string][]).map(([k, v, c]) => (
            <div key={k} className="col gap-1" style={{ minWidth: 70 }}>
              <span className="eyebrow">{k}</span>
              <span className="serif tabular" style={{ fontSize: 34, letterSpacing: '-.01em', color: c }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 48 }}>
        <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column' }}>
          <span className="eyebrow eyebrow-warm">{totalToday > 0 ? 'Session ready' : 'Nothing due'}</span>
          <h2 className="ty-h2" style={{ marginTop: 12, marginBottom: 14 }}>All decks, due first.</h2>
          <p className="body" style={{ maxWidth: 480, flex: 1 }}>
            Reviews first, then learning cards, then new. Recall cards (English → Spanish) use your
            microphone — say the word out loud, like you would in the street.
          </p>
          <div className="row gap-3" style={{ marginTop: 24, alignItems: 'center' }}>
            <button className="btn btn-primary btn-lg" disabled={totalToday === 0} onClick={() => onReview('all')}>
              <Icons.play /> Start review
            </button>
            <span className="kicker" style={{ marginLeft: 'auto' }}>~{totals.estMinutes} min · mic needed</span>
          </div>
        </div>
        <div className="card-flat" style={{ padding: 24 }}>
          <span className="eyebrow">Retention · last 30 days</span>
          <div className="row gap-6" style={{ marginTop: 16, marginBottom: 18 }}>
            <div className="col gap-1">
              <span className="serif tabular" style={{ fontSize: 32 }}>{retention.maturePct != null ? `${retention.maturePct}%` : '—'}</span>
              <span className="kicker">mature cards</span>
            </div>
            <div className="col gap-1">
              <span className="serif tabular" style={{ fontSize: 32 }}>{retention.youngPct != null ? `${retention.youngPct}%` : '—'}</span>
              <span className="kicker">young cards</span>
            </div>
            <div className="col gap-1">
              <span className="serif tabular" style={{ fontSize: 32 }}>{retention.streakDays}</span>
              <span className="kicker">day streak</span>
            </div>
          </div>
          <span className="eyebrow">Due forecast · next 7 days</span>
          <div className="row gap-1" style={{ alignItems: 'flex-end', height: 56, marginTop: 12 }}>
            {forecast.map((n, i) => (
              <div key={i} className="col gap-1" style={{ flex: 1, alignItems: 'center' }}>
                <div style={{ width: '100%', height: `${(n / maxForecast) * 40}px`, minHeight: n > 0 ? 3 : 1, background: i === 0 ? 'var(--warm)' : 'var(--bg-3)', borderRadius: 2 }} />
                <span className="mono" style={{ fontSize: 9, color: 'var(--mute-2)' }}>
                  {i === 0 ? 'hoy' : dayNames[(todayIdx + i) % 7]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deck list */}
      <SectionHead num="01 / Decks" title="Your decks" right={
        <button className="btn btn-ghost btn-sm" onClick={onAddDeck}>+ Add / upload deck</button>
      } />
      <div className="col" style={{ border: '1px solid var(--line)' }}>
        {decks.map((d, i) => {
          const deckTotal = d.counts.due + d.counts.learning + d.counts.newCount;
          return (
            <div key={d.id} className="card-hover row gap-6" style={{ padding: '22px 28px', borderTop: i ? '1px solid var(--line)' : 'none', alignItems: 'center', cursor: deckTotal ? 'pointer' : 'default' }}
              onClick={() => deckTotal && onReview(d.id)}>
              <div className="col gap-1" style={{ flex: 1 }}>
                <div className="row gap-3" style={{ alignItems: 'baseline' }}>
                  <span className="serif" style={{ fontSize: 22, letterSpacing: '-.005em' }}>{d.name}</span>
                  <span className="kicker">{d.noteCount} words</span>
                </div>
                <span className="small">{d.description} · <span style={{ color: 'var(--mute-2)' }}>{d.source}</span></span>
                {/* Audio pre-generation runs in the background after a deck is created;
                    cards play instantly once their clip exists (live TTS until then). */}
                {d.audio && d.audio.ready < d.audio.total && (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--warm)', marginTop: 2 }}>
                    ♪ generating audio · {Math.round((d.audio.ready / Math.max(1, d.audio.total)) * 100)}%
                  </span>
                )}
              </div>
              <div className="row gap-5" style={{ alignItems: 'center' }}>
                {([['new', d.counts.newCount, 'var(--ink-2)'], ['learning', d.counts.learning, 'var(--warm)'], ['due', d.counts.due, 'var(--crit)']] as [string, number, string][]).map(([k, v, c]) => (
                  <div key={k} className="col" style={{ alignItems: 'center', minWidth: 48 }}>
                    <span className="mono tabular" style={{ fontSize: 16, color: v ? c : 'var(--mute-2)' }}>{v}</span>
                    <span className="kicker" style={{ fontSize: 9 }}>{k}</span>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" disabled={!deckTotal} onClick={(e) => { e.stopPropagation(); onReview(d.id); }}>
                  <Icons.play /> Review
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  title="Delete this deck (cards and progress included)"
                  style={{ color: 'var(--mute-2)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${d.name}" (${d.noteCount} words) and its progress? This can't be undone.`)) onDeleteDeck(d.id);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="small" style={{ marginTop: 16, color: 'var(--mute-2)' }}>
        Words you miss in lessons are added to &ldquo;From your mistakes&rdquo; when you rebuild your deck.
      </p>
    </div>
  );
}
