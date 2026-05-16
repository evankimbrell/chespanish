'use client';
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { useFakePlayer } from '@/components/player/use-fake-player';
import { useGeneratedLessonPlayer } from '@/components/player/use-generated-lesson-player';
import { OrbPlayer } from '@/components/player/orb-player';
import { EditorialPlayer } from '@/components/player/editorial-player';
import { ConversationPlayer } from '@/components/player/conversation-player';

const PRELOAD_AHEAD = 8;  // trigger next batch when this many plays remain
const BATCH_SIZE = 25;    // ~5 minutes per batch

function GeneratedLessonPlayerPage() {
  const generatedLesson = useAppStore((s) => s.generatedLesson)!;
  const appendPlays = useAppStore((s) => s.appendPlays);
  const userName = useAppStore((s) => s.profile.name);
  const p = useGeneratedLessonPlayer(generatedLesson);

  const plays = generatedLesson.plays;
  const allMeta = generatedLesson.allPlayMeta ?? plays;
  const total = generatedLesson.totalCount ?? plays.length;

  const loadingRef = useRef(false);

  // Background-load next batch when player is close to the end of loaded audio
  useEffect(() => {
    const loadedCount = plays.length;
    if (loadingRef.current) return;
    if (loadedCount >= total) return;
    if (p.promptIdx + PRELOAD_AHEAD < loadedCount) return;

    loadingRef.current = true;
    const safeUser = userName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    fetch('/api/lesson/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: generatedLesson.transcript,
        userName: safeUser,
        startIdx: loadedCount,
        count: BATCH_SIZE,
      }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.plays?.length) appendPlays(data.plays); })
      .catch((e) => console.error('[player] background load failed:', e))
      .finally(() => { loadingRef.current = false; });
  }, [p.promptIdx, plays.length]);

  const sectionMap: { name: string; startIdx: number }[] = [];
  allMeta.forEach((play, i) => {
    const name = play.sectionName ?? (play.promptAfter ? `Part ${i + 1}` : 'Closing');
    if (!sectionMap.length || sectionMap.at(-1)!.name !== name) {
      sectionMap.push({ name, startIdx: i });
    }
  });
  const sections = sectionMap.map((s, i) => {
    const endIdx = sectionMap[i + 1]?.startIdx ?? total;
    return {
      id: i + 1,
      label: s.name,
      pct: s.startIdx / total,
      end: endIdx / total,
      blurb: allMeta[s.startIdx].text.slice(0, 120) + (allMeta[s.startIdx].text.length > 120 ? '…' : ''),
    };
  });

  const promptDots = allMeta
    .map((play, i) => play.promptAfter ? { id: i + 1, t: (i + 1) / total } : null)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const subtitleLines = allMeta.map((m) => m.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const customWordTimings = plays.map((pl) => pl.wordTimings);

  return (
    <OrbPlayer
      p={p}
      customSections={sections}
      customPrompts={promptDots}
      customSubtitles={subtitleLines.length > 0 ? subtitleLines : undefined}
      customWordTimings={customWordTimings}
      lessonTitle={generatedLesson.title}
    />
  );
}

function FakeLessonPlayerPage() {
  const playerVariant = useAppStore((s) => s.playerVariant);
  const p = useFakePlayer();
  if (playerVariant === 'editorial')    return <EditorialPlayer p={p} />;
  if (playerVariant === 'conversation') return <ConversationPlayer p={p} />;
  return <OrbPlayer p={p} />;
}

export default function PlayerPage() {
  const [mounted, setMounted] = useState(false);
  const generatedLesson = useAppStore((s) => s.generatedLesson);

  useEffect(() => { setMounted(true); }, []);

  // Render fake player on server and first client paint to avoid hydration mismatch
  // (generatedLesson comes from localStorage which is unavailable server-side)
  if (!mounted) return <FakeLessonPlayerPage />;

  const hasAudio = (generatedLesson?.plays?.length ?? 0) > 0;
  if (hasAudio) return <GeneratedLessonPlayerPage />;
  return <FakeLessonPlayerPage />;
}
