'use client';
import { create } from 'zustand';
import type { BuilderState, ComfortLevel, DiagnosticReport, GeneratedLesson, LessonPlay, LevelTestSession, PlayerVariant, ProfileState, PromptResult, TestReport } from './types';

function lessonKey(name: string): string {
  return `che_lesson_${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

function loadLesson(name: string): GeneratedLesson | null {
  if (typeof window === 'undefined') return null;
  try {
    // Try user-specific key first, fall back to old shared key for backward compat
    const raw = localStorage.getItem(lessonKey(name)) ?? localStorage.getItem('che_spanish_lesson');
    return raw ? JSON.parse(raw) as GeneratedLesson : null;
  } catch { return null; }
}

interface AppStore {
  builder: BuilderState;
  setBuilder: (updates: Partial<BuilderState>) => void;

  playerVariant: PlayerVariant;
  setPlayerVariant: (v: PlayerVariant) => void;

  profile: ProfileState;
  setProfile: (updates: Partial<ProfileState>) => void;

  levelTestSession: LevelTestSession | null;
  startLevelTestSession: (comfortLevel?: ComfortLevel | null) => void;
  addPromptResult: (result: PromptResult) => void;
  completeLevelTestSession: (report: TestReport | null) => void;
  setDiagnosticReport: (diagnosticReport: DiagnosticReport | null) => void;

  generatedLesson: GeneratedLesson | null;
  setGeneratedLesson: (lesson: GeneratedLesson) => void;
  appendPlays: (newPlays: LessonPlay[]) => void;
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
    lessonsCompleted: 0,
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

  // When switching profiles, also swap the generated lesson to the new user's
  setProfile: (updates) =>
    set((s) => {
      const newProfile = { ...s.profile, ...updates };
      let newLesson = s.generatedLesson;
      if (updates.name && updates.name !== s.profile.name) {
        newLesson = loadLesson(updates.name);
      }
      return { profile: newProfile, generatedLesson: newLesson };
    }),

  levelTestSession: null,

  startLevelTestSession: (comfortLevel = null) =>
    set({
      levelTestSession: {
        startedAt: new Date().toISOString(),
        completedAt: null,
        comfortLevel,
        prompts: [],
        report: null,
      },
    }),

  addPromptResult: (result) =>
    set((s) => ({
      levelTestSession: s.levelTestSession
        ? { ...s.levelTestSession, prompts: [...s.levelTestSession.prompts, result] }
        : s.levelTestSession,
    })),

  completeLevelTestSession: (report) =>
    set((s) => {
      if (!s.levelTestSession) return s;
      const completed: LevelTestSession = {
        ...s.levelTestSession,
        completedAt: new Date().toISOString(),
        report,
      };
      try {
        localStorage.setItem('che_spanish_level_test', JSON.stringify(completed, null, 2));
      } catch {}
      return { levelTestSession: completed };
    }),

  setDiagnosticReport: (diagnosticReport) =>
    set((s) => {
      if (!s.levelTestSession) return s;
      const updated: LevelTestSession = { ...s.levelTestSession, diagnosticReport };
      try {
        localStorage.setItem('che_spanish_level_test', JSON.stringify(updated, null, 2));
      } catch {}
      return { levelTestSession: updated };
    }),

  generatedLesson: loadLesson('Mateo'),

  setGeneratedLesson: (lesson) =>
    set((s) => {
      try { localStorage.setItem(lessonKey(s.profile.name), JSON.stringify(lesson)); } catch {}
      return { generatedLesson: lesson };
    }),

  appendPlays: (newPlays) =>
    set((s) => {
      if (!s.generatedLesson) return s;
      const updated: GeneratedLesson = {
        ...s.generatedLesson,
        plays: [...s.generatedLesson.plays, ...newPlays],
      };
      try { localStorage.setItem(lessonKey(s.profile.name), JSON.stringify(updated)); } catch {}
      return { generatedLesson: updated };
    }),
}));
