'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { Wave } from '@/components/ui/wave';
import { Scrubber } from '@/components/ui/scrubber';
import { Tag } from '@/components/ui/tag';
import { AskOverlay } from './ask-overlay';
import { LESSON, SECTIONS } from '@/lib/data';
import type { FakePlayer } from './use-fake-player';

export function EditorialPlayer({ p }: { p: FakePlayer }) {
  const [showText, setShowText] = useState(false);
  const router = useRouter();
  const prompt = LESSON.prompts[p.promptIdx];

  return (
    <div className="page-narrow fade-in" style={{ maxWidth: 920 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn btn-text small" style={{ paddingLeft: 0 }} onClick={() => router.push('/preview')}>
          <Icons.arrowLeft /> Lesson preview
        </button>
        <span className="kicker">SECTION 03 · PROMPT-RESPONSE</span>
      </div>

      <span className="eyebrow eyebrow-warm">Lesson player</span>
      <h1 className="ty-h2" style={{ marginTop: 14, marginBottom: 32 }}>{LESSON.title}.</h1>

      <Scrubber progress={p.progress} markers={SECTIONS.map((s) => ({ t: s.pct, label: s.label }))} onSeek={p.seek} />

      <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 48 }}>
        <button
          className={'btn btn-icon ' + (p.state === 'playing' ? 'btn-ghost' : 'btn-primary')}
          style={{ width: 80, height: 80, borderRadius: '50%' }}
          onClick={p.state === 'playing' ? p.pause : p.play}
        >
          {p.state === 'playing' ? <Icons.pause /> : <Icons.play />}
        </button>

        <div className="col gap-3" style={{ justifyContent: 'center' }}>
          <span className="eyebrow">{p.state === 'prompting' ? 'Respond now' : 'Tutor speaking'}</span>
          <Wave playing={p.state === 'playing'} count={64} height={30} />
          {showText && prompt && (
            <p className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>&ldquo;{prompt.cue}&rdquo;</p>
          )}
          <div className="row gap-3">
            <button className="btn btn-text small" onClick={() => setShowText((s) => !s)} style={{ padding: 0 }}>
              {showText ? 'Hide text' : 'Show text'}
            </button>
            <button className="btn btn-text small" onClick={p.ask} style={{ padding: 0 }}>
              <Icons.spark /> Ask a question
            </button>
          </div>
        </div>
      </div>

      {p.state === 'prompting' && (
        <button className="btn btn-warm btn-lg" style={{ marginTop: 32 }} onClick={p.record}>
          <Icons.mic /> Tap to respond
        </button>
      )}

      {p.state === 'feedback' && prompt && (
        <div className="card fade-in" style={{ padding: 24, marginTop: 24 }}>
          <Tag kind="warm">● {prompt.status}</Tag>
          <span className="small" style={{ marginLeft: 8 }}>{prompt.note}</span>
          <p className="serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 10 }}>&ldquo;{prompt.es}&rdquo;</p>
          <div className="row gap-2" style={{ marginTop: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={p.retry}>Try again</button>
            <button className="btn btn-primary btn-sm" onClick={p.next}>Continue <Icons.arrow /></button>
          </div>
        </div>
      )}

      {p.state === 'complete' && (
        <div className="card fade-in" style={{ padding: 32, textAlign: 'center', marginTop: 40 }}>
          <h2 className="ty-h2">Buen laburo.</h2>
          <button className="btn btn-primary btn-lg" style={{ marginTop: 18 }} onClick={() => router.push('/report')}>
            See your report <Icons.arrow />
          </button>
        </div>
      )}

      <AskOverlay p={p} />
    </div>
  );
}
