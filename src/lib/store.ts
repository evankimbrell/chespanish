'use client';
import { create } from 'zustand';
import type { BuilderState, ComfortLevel, LevelTestSession, PlayerVariant, ProfileState, PromptMetric } from './types';

interface AppStore {
  builder: BuilderState;
  setBuilder: (updates: Partial<BuilderState>) => void;

  playerVariant: PlayerVariant;
  setPlayerVariant: (v: PlayerVariant) => void;

  profile: ProfileState;
  setProfile: (updates: Partial<ProfileState>) => void;

  levelTestSession: LevelTestSession | null;
  startLevelTestSession: (comfortLevel?: ComfortLevel | null) => void;
  addPromptMetric: (metric: PromptMetric) => void;
  completeLevelTestSession: () => void;
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
    comfortLevel: null,
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
  setProfile: (updates) =>
    set((s) => ({ profile: { ...s.profile, ...updates } })),

  levelTestSession: null,

  startLevelTestSession: (comfortLevel = null) =>
    set({
      levelTestSession: {
        startedAt: new Date().toISOString(),
        completedAt: null,
        comfortLevel,
        prompts: [],
      },
    }),

  addPromptMetric: (metric) =>
    set((s) => ({
      levelTestSession: s.levelTestSession
        ? { ...s.levelTestSession, prompts: [...s.levelTestSession.prompts, metric] }
        : s.levelTestSession,
    })),

  completeLevelTestSession: () =>
    set((s) => {
      if (!s.levelTestSession) return s;
      const completed: LevelTestSession = {
        ...s.levelTestSession,
        completedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem('che_spanish_level_test', JSON.stringify(completed, null, 2));
      } catch {}
      return { levelTestSession: completed };
    }),
}));
