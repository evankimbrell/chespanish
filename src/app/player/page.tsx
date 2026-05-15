'use client';
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

  const sections = plays.map((play, i) => ({
    id: i + 1,
    label: play.promptAfter ? `Part ${i + 1}` : 'Closing',
    pct: i / total,
    end: (i + 1) / total,
    blurb: play.text.slice(0, 120) + (play.text.length > 120 ? '…' : ''),
  }));

  const promptDots = plays
    .map((play, i) => play.promptAfter ? { id: i + 1, t: (i + 1) / total } : null)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const subtitleLines = plays.slice(0, 6).map((pl) => pl.text.slice(0, 80));

  return (
    <OrbPlayer
      p={p}
      customSections={sections}
      customPrompts={promptDots}
      customSubtitles={subtitleLines.length > 0 ? subtitleLines : undefined}
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
  const generatedLesson = useAppStore((s) => s.generatedLesson);
  const hasAudio = (generatedLesson?.plays?.length ?? 0) > 0;

  if (hasAudio) return <GeneratedLessonPlayerPage />;
  return <FakeLessonPlayerPage />;
}
