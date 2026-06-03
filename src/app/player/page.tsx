'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  const requestedStartsRef = useRef<Set<number>>(new Set()); // startIdx values already fetched — never double-append a batch

  // Always-current ref to avoid stale closures in save/cleanup
  const saveHistoryRef = useRef<(playIdx: number, completed: boolean) => void>(() => {});
  saveHistoryRef.current = (playIdx: number, completed: boolean) => {
    const topics = [...new Set(
      allMeta.map((m) => m.sectionName).filter((s): s is string => Boolean(s))
    )].slice(0, 5);
    fetch('/api/lesson/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName,
        entry: {
          id: generatedLesson.generatedAt,
          title: generatedLesson.title,
          transcript: generatedLesson.transcript,
          startedAt: generatedLesson.generatedAt,
          lastAccessedAt: new Date().toISOString(),
          playIdx,
          totalCount: total,
          completed,
          topics,
        },
      }),
    }).catch(() => {});
  };

  // Record lesson start on mount
  useEffect(() => {
    saveHistoryRef.current(0, false);
  }, []);

  // Save progress 3s after promptIdx changes
  useEffect(() => {
    const t = setTimeout(() => saveHistoryRef.current(p.promptIdx, false), 3000);
    return () => clearTimeout(t);
  }, [p.promptIdx]);

  // Save immediately when lesson completes
  useEffect(() => {
    if (p.state === 'complete') saveHistoryRef.current(p.promptIdx, true);
  }, [p.state]);

  // Track latest values for unmount save
  const latestRef = useRef({ promptIdx: 0, state: '' });
  latestRef.current = { promptIdx: p.promptIdx, state: p.state };
  useEffect(() => {
    return () => {
      saveHistoryRef.current(latestRef.current.promptIdx, latestRef.current.state === 'complete');
    };
  }, []);

  // Background-load next batch when player is close to the end of loaded audio
  useEffect(() => {
    const loadedCount = plays.length;
    if (loadingRef.current) return;
    if (loadedCount >= total) return;
    if (p.promptIdx + PRELOAD_AHEAD < loadedCount) return;
    // Never request the same batch twice — a double-append would duplicate audio
    // and misalign plays[] from the section/prompt metadata.
    if (requestedStartsRef.current.has(loadedCount)) return;
    requestedStartsRef.current.add(loadedCount);

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
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  // Redirect to /lesson for audio generation if transcript exists but audio hasn't been generated yet
  useEffect(() => {
    if (!mounted) return;
    const hasAudio = (generatedLesson?.plays?.length ?? 0) > 0;
    const hasTranscript = !!generatedLesson?.transcript;
    if (!hasAudio && hasTranscript) {
      router.replace('/lesson');
    }
  }, [mounted, generatedLesson, router]);

  // Render fake player on server and first client paint to avoid hydration mismatch
  // (generatedLesson comes from localStorage which is unavailable server-side)
  if (!mounted) return <FakeLessonPlayerPage />;

  const hasAudio = (generatedLesson?.plays?.length ?? 0) > 0;
  const hasTranscript = !!generatedLesson?.transcript;

  if (hasAudio) return <GeneratedLessonPlayerPage />;
  // If transcript exists but no audio, the useEffect above will redirect to /lesson
  // Show a brief loading state rather than the fake demo
  if (hasTranscript) return null;
  return <FakeLessonPlayerPage />;
}
