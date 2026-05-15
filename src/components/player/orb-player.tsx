'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { Scrubber } from '@/components/ui/scrubber';
import { OrbWithSections } from './orb-with-sections';
import { UserResponseAnalysis } from './user-response-analysis';
import { AskOverlay } from './ask-overlay';
import { LESSON, SECTIONS, SUBTITLE_LINES } from '@/lib/data';
import type { FakePlayer } from './use-fake-player';

interface Section { id: number; label: string; pct: number; end: number; blurb?: string }
interface PromptDot { id: number; t: number; cue?: string; es?: string }

interface OrbPlayerProps {
  p: FakePlayer;
  customSections?: Section[];
  customPrompts?: PromptDot[];
  customSubtitles?: string[];
  lessonTitle?: string;
}

export function OrbPlayer({ p, customSections, customPrompts, customSubtitles, lessonTitle }: OrbPlayerProps) {
  const [hoverSection, setHoverSection] = useState<number | null>(null);
  const [showText, setShowText] = useState(false);
  const router = useRouter();

  const sections = customSections ?? SECTIONS;
  const prompts = customPrompts ?? LESSON.prompts;
  const subtitleLines = customSubtitles ?? SUBTITLE_LINES;

  const prompt = prompts[p.promptIdx];
  const activeSection = sections.find((s) => p.progress >= s.pct && p.progress < s.end) || sections[0];
  const displaySection = hoverSection != null ? sections.find((s) => s.id === hoverSection) : activeSection;

  const mins  = Math.floor(p.progress * 25);
  const secs  = String(Math.floor((p.progress * 25 % 1) * 60)).padStart(2, '0');

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page" style={{ paddingTop: 28, paddingBottom: 0, flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1200 }}>

        {/* Top bar */}
        <div className="row between" style={{ marginBottom: 8 }}>
          <button className="btn btn-text small" style={{ paddingLeft: 0 }} onClick={() => router.push('/preview')}>
            <Icons.arrowLeft /> Exit lesson
          </button>
          <div className="col gap-1" style={{ textAlign: 'center' }}>
            <span className="kicker">{lessonTitle ?? LESSON.title}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)' }}>
              {Math.round(p.progress * 100)}% · section {String(activeSection?.id ?? 1).padStart(2, '0')} of {String(sections.length).padStart(2, '0')}
            </span>
          </div>
          <button className="btn btn-text small" onClick={p.ask}>
            <Icons.spark /> Ask a question
          </button>
        </div>

        {/* Orb area */}
        <div className="col center" style={{ flex: 1, padding: '24px 0', position: 'relative' }}>
          <OrbWithSections
            progress={p.progress}
            sections={sections}
            prompts={prompts}
            active={p.state === 'playing' || p.state === 'recording'}
            accent={p.state === 'recording'}
            hoverSection={hoverSection}
            setHoverSection={setHoverSection}
            onSeek={p.seek}
            state={p.state}
            onPlay={p.play}
            onPause={p.pause}
            onRecord={p.record}
          />

          {/* Section description — only when text is shown */}
          {showText && displaySection && (
            <div style={{ maxWidth: 560, textAlign: 'center', marginTop: 18 }}>
              <span className="eyebrow eyebrow-warm">
                SECTION {String(displaySection.id).padStart(2, '0')} · {displaySection.label}
              </span>
              <p className="body" style={{ marginTop: 8, fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', fontSize: 18, color: 'var(--ink-2)' }}>
                {displaySection.blurb}
              </p>
            </div>
          )}

          {/* Show text toggle — only after lesson has started */}
          {!(p.state === 'idle' && p.progress === 0) && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setShowText((s) => !s)}>
              {showText ? 'Hide text' : 'Show text'}
            </button>
          )}

          {/* Subtitle card */}
          {showText && p.state !== 'prompting' && p.state !== 'feedback' && (
            <div
              className="fade-in"
              style={{
                marginTop: 16, padding: '16px 24px',
                background: 'rgba(10,9,8,.7)', backdropFilter: 'blur(8px)',
                border: '1px solid var(--line)', borderRadius: 4, maxWidth: 680, textAlign: 'center',
              }}
            >
              <span className="kicker">CC · {p.subtitleIdx + 1} / {subtitleLines.length}</span>
              <p className="serif" style={{ fontSize: 24, fontStyle: 'italic', margin: '8px 0 0', lineHeight: 1.35 }}>
                &ldquo;{subtitleLines[p.subtitleIdx % subtitleLines.length]}&rdquo;
              </p>
            </div>
          )}

          {/* Prompting cue */}
          {p.state === 'prompting' && (
            <div className="col gap-3 fade-in" style={{ alignItems: 'center', marginTop: 20, maxWidth: 600, textAlign: 'center' }}>
              <span className="eyebrow eyebrow-warm">Your turn · respond now</span>
              {prompt?.cue && <p className="serif" style={{ fontSize: 26, fontStyle: 'italic' }}>&ldquo;{prompt.cue}&rdquo;</p>}
            </div>
          )}

          {/* Feedback */}
          {p.state === 'feedback' && (
            <div className="fade-in" style={{ marginTop: 24, maxWidth: 720, width: '100%' }}>
              {p.transcript != null ? (
                <div className="card" style={{ padding: 24 }}>
                  <span className="eyebrow">YOU SAID</span>
                  <p className="serif" style={{ fontSize: 26, fontStyle: 'italic', lineHeight: 1.4, margin: '8px 0 0' }}>
                    &ldquo;{p.transcript}&rdquo;
                  </p>
                  {(prompt as { es?: string })?.es && (
                    <>
                      <hr className="divider" style={{ margin: '18px 0' }} />
                      <span className="eyebrow eyebrow-warm">TARGET</span>
                      <p className="serif" style={{ fontSize: 24, fontStyle: 'italic', marginTop: 8, marginBottom: 0 }}>
                        &ldquo;{(prompt as { es?: string }).es}&rdquo;
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <UserResponseAnalysis target={(prompt as { es?: string })?.es ?? ''} />
              )}
              <div className="row gap-2" style={{ marginTop: 18, justifyContent: 'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={p.retry}><Icons.refresh /> Try again</button>
                <button className="btn btn-ghost btn-sm"><Icons.play /> Hear correct version</button>
                <button className="btn btn-primary btn-sm" onClick={p.next}>Continue <Icons.arrow /></button>
              </div>
            </div>
          )}

          {/* Idle start state */}
          {p.state === 'idle' && p.progress === 0 && (
            <p className="lede" style={{ marginTop: 24, maxWidth: 480, textAlign: 'center' }}>
              Press play. The audio will pause when it&rsquo;s your turn — speak naturally.
            </p>
          )}

          {/* Complete */}
          {p.state === 'complete' && (
            <div className="col gap-4 fade-in" style={{ alignItems: 'center', marginTop: 24 }}>
              <h2 className="ty-h1">Buen laburo.</h2>
              <button className="btn btn-primary btn-lg" onClick={() => router.push('/report')}>
                See your report <Icons.arrow />
              </button>
            </div>
          )}
        </div>

        {/* Bottom scrubber */}
        <div style={{ padding: '20px 0', borderTop: '1px solid var(--line)' }}>
          <Scrubber progress={p.progress} markers={sections.map((s) => ({ t: s.pct }))} onSeek={p.seek} />
          <div className="row between" style={{ marginTop: 8 }}>
            <span className="kicker tabular">{mins}:{secs}</span>
            <span className="kicker">25:00</span>
          </div>
        </div>
      </div>

      <AskOverlay p={p} />
    </div>
  );
}
