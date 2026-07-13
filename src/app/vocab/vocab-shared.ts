import type { DeckDirectionSetting, VocabCard, VocabGrade, VocabNote } from '@/lib/types';
import type { RetentionStats } from '@/lib/vocab-stats';

// Client-side shapes of the /api/vocab payloads (kept separate from the route files so
// client components never import server code).

export interface DeckSummary {
  id: string;
  name: string;
  description: string;
  source: string;
  direction: DeckDirectionSetting;
  noteCount: number;
  counts: { newCount: number; learning: number; due: number };
  audio: { total: number; ready: number };
}

export interface VocabHomePayload {
  setupCompleted: boolean;
  decks: DeckSummary[];
  totals: { newCount: number; learning: number; due: number; estMinutes: number };
  forecast: number[];
  retention: RetentionStats;
}

export interface SessionCard {
  card: VocabCard;
  note: VocabNote;
  deckId: string;
  deckName: string;
}

// One entry per graded card this session — drives the summary screen.
export interface SessionResult {
  note: VocabNote;
  deckId: string;
  direction: string;
  firstGrade: VocabGrade;
  newDue: string;
  verdict?: 'match' | 'no_match';
}
