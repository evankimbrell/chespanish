'use client';
import { create } from 'zustand';
import type { BuilderState, PlayerVariant, ProfileState } from './types';

interface AppStore {
  builder: BuilderState;
  setBuilder: (updates: Partial<BuilderState>) => void;

  playerVariant: PlayerVariant;
  setPlayerVariant: (v: PlayerVariant) => void;

  profile: ProfileState;
}

export const useAppStore = create<AppStore>((set) => ({
  builder: {
    scenario: 'restaurant',
    focus: 'recent',
    mistakes: ['tenes', 'slow'],
    grammar: [],
    diffOffset: 0,
    length: 25,
    custom: '',
  },
  setBuilder: (updates) =>
    set((s) => ({ builder: { ...s.builder, ...updates } })),

  playerVariant: 'orb',
  setPlayerVariant: (v) => set({ playerVariant: v }),

  profile: {
    name: 'Mateo',
    level: 'B1',
    lessonsCompleted: 12,
    streak: 5,
    totalSpeaking: '4h 32m',
    lastLessonAt: 'May 9',
    settings: {
      dialect: 'rioplatense',
      explanations: 'minimal',
      defaultLength: 25,
      defaultDifficultyOffset: 0,
      showTranscriptByDefault: false,
      showTranslationByDefault: false,
      playbackSpeed: 1.0,
    },
  },
}));
