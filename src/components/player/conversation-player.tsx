'use client';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { AskOverlay } from './ask-overlay';
import { LESSON } from '@/lib/data';
import type { FakePlayer } from './use-fake-player';

export function ConversationPlayer({ p }: { p: FakePlayer }) {
  const router = useRouter();
  const prompt = LESSON.prompts[p.promptIdx];

  return (
    <div className="page-narrow fade-in" style={{ maxWidth: 760 }}>
      <div className="row between" style={{ marginBottom: 24 }}>
        <button className="btn btn-text small" style={{ paddingLeft: 0 }} onClick={() => router.push('/preview')}>
          <Icons.arrowLeft /> Exit lesson
        </button>
        <span className="kicker">{LESSON.title} · 03 / 06</span>
        <button className="btn btn-text small" onClick={p.ask}><Icons.spark /> Ask</button>
      </div>

      <div className="progress" style={{ marginBottom: 32 }}>
        <div className="progress-fill" style={{ width: `${p.progress * 100}%` }} />
      </div>

      <div className="col gap-4">
        {prompt && (
          <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
            <span className="brand-mark" style={{ marginTop: 4 }} />
            <div style={{ background: 'var(--bg-2)', padding: '14px 18px', borderRadius: '2px 14px 14px 14px', maxWidth: 520 }}>
              <p className="serif" style={{ fontSize: 18, fontStyle: 'italic', margin: 0 }}>{prompt.cue}</p>
            </div>
          </div>
        )}
        {p.state === 'feedback' && prompt && (
          <div className="row gap-3" style={{ justifyContent: 'flex-end' }}>
            <div style={{ background: 'var(--ink)', color: '#100e0c', padding: '14px 18px', borderRadius: '14px 2px 14px 14px', maxWidth: 520 }}>
              <p className="serif" style={{ fontSize: 18, fontStyle: 'italic', margin: 0 }}>{prompt.userSays}</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 24, padding: '20px 0', marginTop: 24, borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
        {p.state === 'idle' && (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={p.play}><Icons.play /> Start lesson</button>
        )}
        {p.state === 'prompting' && (
          <button className="btn btn-warm" style={{ width: '100%' }} onClick={p.record}><Icons.mic /> Hold to respond</button>
        )}
        {p.state === 'feedback' && (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={p.next}>Continue <Icons.arrow /></button>
        )}
        {p.state === 'complete' && (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => router.push('/report')}>See your report <Icons.arrow /></button>
        )}
      </div>

      <AskOverlay p={p} />
    </div>
  );
}
