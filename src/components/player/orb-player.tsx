'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { Scrubber } from '@/components/ui/scrubber';
import { OrbWithSections } from './orb-with-sections';
import { UserResponseAnalysis } from './user-response-analysis';
import { KaraokeTranscript } from './karaoke-transcript';
import { LESSON, SECTIONS, SUBTITLE_LINES } from '@/lib/data';
import type { FakePlayer } from './use-fake-player';
import type { WordTiming } from '@/lib/types';

interface Section { id: number; label: string; pct: number; end: number; blurb?: string }
interface PromptDot { id: number; t: number; cue?: string; es?: string }

interface OrbPlayerProps {
  p: FakePlayer;
  customSections?: Section[];
  customPrompts?: PromptDot[];
  customSubtitles?: string[];
  customWordTimings?: (WordTiming[] | undefined)[];
  lessonTitle?: string;
}

export function OrbPlayer({ p, customSections, customPrompts, customSubtitles, customWordTimings, lessonTitle }: OrbPlayerProps) {
  const [hoverSection, setHoverSection] = useState<number | null>(null);
  const [showText, setShowText] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      e.preventDefault();
      if (p.state === 'prompting' || p.state === 'recording' || p.state === 'asking') {
        p.record();
      } else if (p.state === 'feedback') {
        p.next();
      } else if (p.state === 'playing') {
        p.pause();
      } else if (p.state === 'idle') {
        p.play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.state, p.record, p.next, p.play, p.pause]);

  const sections = customSections ?? SECTIONS;
  const prompts = customPrompts ?? LESSON.prompts;
  const subtitleLines = customSubtitles ?? SUBTITLE_LINES;

  const prompt = prompts[p.promptIdx];
  const activeSection = sections.find((s) => p.progress >= s.pct && p.progress < s.end) || sections[0];
  const displaySection = hoverSection != null ? sections.find((s) => s.id === hoverSection) : activeSection;

  const elapsedSec  = p.elapsedSeconds ?? (p.progress * 25 * 60);
  const totalSec    = p.totalSeconds   ?? (25 * 60);
  const mins  = Math.floor(elapsedSec / 60);
  const secs  = String(Math.floor(elapsedSec % 60)).padStart(2, '0');
  const totalMins = Math.floor(totalSec / 60);
  const totalSecsDisplay = String(Math.floor(totalSec % 60)).padStart(2, '0');

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page" style={{ paddingTop: 28, paddingBottom: 0, flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1200 }}>

        {/* Top bar */}
        <div className="row between" style={{ marginBottom: 8 }}>
          <button className="btn btn-text small" style={{ paddingLeft: 0 }} onClick={() => router.push('/dashboard')}>
            <Icons.arrowLeft /> Exit lesson
          </button>
          <div className="col gap-1" style={{ textAlign: 'center' }}>
            <span className="kicker">{lessonTitle ?? LESSON.title}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)' }}>
              {Math.round(p.progress * 100)}% · section {String(activeSection?.id ?? 1).padStart(2, '0')} of {String(sections.length).padStart(2, '0')}
            </span>
          </div>
          <button
            className="btn btn-text small"
            onClick={p.ask}
            disabled={p.state === 'answering'}
            style={{ opacity: p.state === 'asking' || p.state === 'answering' ? 0.5 : 1 }}
          >
            <Icons.spark />
            {p.state === 'asking' ? 'Recording…' : p.state === 'answering' ? 'Getting answer…' : 'Ask a question'}
          </button>
        </div>

        {/* Orb area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {/* Fixed top spacer — anchors orb at a stable vertical position regardless of content below */}
          <div style={{ flex: '0 0 80px' }} />

          <OrbWithSections
            progress={p.progress}
            sections={sections}
            prompts={prompts}
            active={p.state === 'playing' || p.state === 'recording' || p.state === 'asking'}
            accent={p.state === 'recording' || p.state === 'asking'}
            hoverSection={hoverSection}
            setHoverSection={setHoverSection}
            onSeek={p.seek}
            state={p.state}
            onPlay={p.play}
            onPause={p.pause}
            onRecord={p.record}
          />

          {/* Show text toggle — only when audio is playing/idle (not during prompting/recording/feedback) */}
          {!(p.state === 'idle' && p.progress === 0) &&
            p.state !== 'feedback' &&
            p.state !== 'prompting' &&
            p.state !== 'recording' &&
            p.state !== 'processing' && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 48 }} onClick={() => setShowText((s) => !s)}>
              {showText ? 'Hide text' : 'Show text'}
            </button>
          )}

          {/* Transcript / subtitle card */}
          {showText && p.state !== 'prompting' && p.state !== 'feedback' && p.state !== 'recording' && p.state !== 'processing' && (
            customSubtitles ? (
              <KaraokeTranscript
                text={subtitleLines[p.promptIdx] ?? ''}
                audioProgress={p.audioProgress ?? 0}
                currentTime={p.audioCurrentTime}
                wordTimings={customWordTimings?.[p.promptIdx]}
              />
            ) : (
              // Fake demo player: cycling CC display
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
            )
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

                  {/* Grade — appears when grading resolves */}
                  {p.grade ? (
                    <div className="fade-in" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                      <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 6 }}>
                        <span className={`eyebrow ${p.grade.label === 'Excellent' || p.grade.label === 'Good' ? 'eyebrow-warm' : ''}`}>
                          {p.grade.label}
                        </span>
                      </div>
                      {p.grade.brief_feedback && (
                        <p className="small" style={{ color: 'var(--ink-2)', margin: 0 }}>{p.grade.brief_feedback}</p>
                      )}
                      {(p.grade.observed_errors?.length ?? 0) > 0 && (
                        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                          {p.grade.observed_errors.map((err, i) => (
                            <li key={i} className="small" style={{ color: 'var(--mute)', marginBottom: 4 }}>
                              <strong>{err.category}</strong>: {err.description}
                            </li>
                          ))}
                        </ul>
                      )}
                      {p.grade.suggested_answer && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                          <span className="eyebrow eyebrow-warm" style={{ display: 'block', marginBottom: 4 }}>Try saying</span>
                          <p className="serif" style={{ fontSize: 18, fontStyle: 'italic', margin: 0, color: 'var(--ink)' }}>
                            &ldquo;{p.grade.suggested_answer}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="small" style={{ color: 'var(--mute)', marginTop: 14, marginBottom: 0 }}>Grading…</p>
                  )}
                </div>
              ) : (
                <UserResponseAnalysis target={(prompt as { es?: string })?.es ?? ''} />
              )}
              <div className="row gap-2" style={{ marginTop: 18, justifyContent: 'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={p.retry}><Icons.refresh /> Try again</button>
                {p.playCorrect && <button className="btn btn-ghost btn-sm" onClick={p.playCorrect}><Icons.play /> Hear correct version</button>}
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
            <span className="kicker">{totalMins}:{totalSecsDisplay}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
