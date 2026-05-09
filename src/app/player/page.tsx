'use client';
import { useAppStore } from '@/lib/store';
import { useFakePlayer } from '@/components/player/use-fake-player';
import { OrbPlayer } from '@/components/player/orb-player';
import { EditorialPlayer } from '@/components/player/editorial-player';
import { ConversationPlayer } from '@/components/player/conversation-player';

export default function PlayerPage() {
  const playerVariant = useAppStore((s) => s.playerVariant);
  const p = useFakePlayer();

  if (playerVariant === 'editorial')    return <EditorialPlayer p={p} />;
  if (playerVariant === 'conversation') return <ConversationPlayer p={p} />;
  return <OrbPlayer p={p} />;
}
