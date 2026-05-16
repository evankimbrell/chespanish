'use client';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useFakePlayer } from '@/components/player/use-fake-player';
import { useGeneratedLessonPlayer } from '@/components/player/use-generated-lesson-player';
import { OrbPlayer } from '@/components/player/orb-player';
import { EditorialPlayer } from '@/components/player/editorial-player';
import { ConversationPlayer } from '@/components/player/conversation-player';

function GeneratedLessonPlayerPage() {
  const generatedLesson = useAppStore((s) => s.generatedLesson)!;
  const p = useGeneratedLessonPlayer(generatedLesson);
  const plays = generatedLesson.plays;
  const total = plays.length;

  const sectionMap: { name: string; startIdx: number }[] = [];
  plays.forEach((play, i) => {
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
      blurb: plays[s.startIdx].text.slice(0, 120) + (plays[s.startIdx].text.length > 120 ? '…' : ''),
    };
  });

  const promptDots = plays
    .map((play, i) => play.promptAfter ? { id: i + 1, t: (i + 1) / total } : null)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const subtitleLines = plays.map((pl) =>
    pl.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );

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
