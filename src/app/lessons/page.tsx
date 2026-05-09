'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { Tag } from '@/components/ui/tag';
import { Icons } from '@/components/ui/icons';
import { RECENT_LESSONS, LESSON } from '@/lib/data';

type LessonItem = typeof RECENT_LESSONS[0];

function LessonDetail({ lesson, back }: { lesson: LessonItem; back: () => void }) {
  const router = useRouter();
  return (
    <div className="page-narrow fade-in">
      <button className="btn btn-text small" style={{ paddingLeft: 0, marginBottom: 12 }} onClick={back}>
        <Icons.arrowLeft /> All lessons
      </button>
      <span className="eyebrow">Completed {lesson.date} · {lesson.duration} min · {lesson.level}</span>
      <h1 className="ty-h1" style={{ marginTop: 14, marginBottom: 24 }}>{lesson.title}.</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, border: '1px solid var(--line)', marginBottom: 40 }}>
        {[['Score', lesson.score, 'of 100'], ['Mistakes', lesson.mistakes, 'mostly conjugation'], ['Avg response', '5.2s', 'vs target 4.0s']].map(([k, v, s], i) => (
          <div key={String(k)} style={{ padding: '20px 24px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
            <span className="eyebrow">{k}</span>
            <div className="serif" style={{ fontSize: 32, marginTop: 6 }}>{v}</div>
            <span className="kicker">{s}</span>
          </div>
        ))}
      </div>

      <SectionHead title="Replay sections" sub="The point of an old lesson is the audio, not the transcript. Replay only what was hard." />
      <div className="col gap-2" style={{ marginBottom: 48 }}>
        {[
          ['Full lesson', '26 min', 'from start', true],
          ['Just the prompts you missed', '3 prompts · ~2 min', 'the value cut', false],
          ['Slow-response prompts', '5 prompts · ~3 min', '', false],
          ['Listening dialogue only', 'one section · 4 min', '', false],
          ['Roleplay only', 'one scene · 5 min', '', false],
        ].map(([t, m, note, hi], i) => (
          <button
            key={i}
            className="row gap-4"
            style={{ padding: '16px 20px', background: hi ? 'var(--bg-2)' : 'transparent', border: '1px solid var(--line)', borderRadius: 4, alignItems: 'center', cursor: 'pointer', textAlign: 'left', width: '100%', color: 'inherit' }}
            onClick={() => router.push('/player')}
          >
            <Icons.play style={{ color: hi ? 'var(--warm)' : 'var(--ink-2)' }} />
            <div className="col" style={{ flex: 1 }}>
              <span className="serif" style={{ fontSize: 18 }}>{t}</span>
              <span className="small">{m}{note ? ' · ' + note : ''}</span>
            </div>
            <Icons.arrow style={{ color: 'var(--mute)' }} />
          </button>
        ))}
      </div>

      <SectionHead title="Outline + transcript" />
      <div className="col" style={{ border: '1px solid var(--line)' }}>
        {LESSON.outline.map((s, i) => (
          <div key={s.n} style={{ padding: '16px 20px', borderTop: i ? '1px solid var(--line)' : 'none' }} className="row between">
            <div className="row gap-4" style={{ alignItems: 'baseline' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)' }}>0{s.n}</span>
              <span className="serif" style={{ fontSize: 18 }}>{s.label}</span>
            </div>
            <button className="btn btn-text small" onClick={() => router.push('/player')}><Icons.play /> Replay</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const FILTERS = ['All', 'This week', 'Restaurant', 'Social', 'B1', 'High mistakes'];

export default function LessonsPage() {
  const [detail, setDetail] = useState<LessonItem | null>(null);

  if (detail) return <><TopNav /><LessonDetail lesson={detail} back={() => setDetail(null)} /></>;

  return (
    <>
      <TopNav />
      <div className="page fade-in">
        <SectionHead num="01 / Library" title="Finished lessons." sub="Replay full lessons, just the prompts you missed, or only the listening sections." />

        <div className="row gap-2" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
          {FILTERS.map((f, i) => (
            <button key={f} className={'chip' + (i === 0 ? ' selected' : '')}>{f}</button>
          ))}
          <button className="btn btn-text small" style={{ marginLeft: 'auto' }}>
            Sort: most recent <Icons.arrow style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
          {RECENT_LESSONS.map((l) => (
            <div
              key={l.id}
              className="card-hover"
              style={{ background: 'var(--bg)', padding: 28, cursor: 'pointer' }}
              onClick={() => setDetail(l)}
            >
              <div className="row between" style={{ marginBottom: 14, alignItems: 'center' }}>
                <span className="kicker">{l.date} · {l.duration} min · {l.level}</span>
                <Tag kind={l.score >= 85 ? 'leaf' : 'warm'}>{l.score}</Tag>
              </div>
              <h3 className="ty-h3" style={{ marginBottom: 10 }}>{l.title}.</h3>
              <p className="small" style={{ marginBottom: 18 }}>Focus · {l.focus}</p>
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                <Tag kind="mute">{l.mistakes} mistakes</Tag>
                <button className="btn btn-text small" style={{ marginLeft: 'auto', padding: 0 }}>Open <Icons.arrow /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
