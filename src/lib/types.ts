export type MistakeCategory =
  | 'Conjugation' | 'Grammar' | 'Tense' | 'Listening' | 'Speed'
  | 'Naturalness' | 'Pronunciation' | 'Vocabulary' | 'Flow' | 'Word order';

export type FeedbackKind = 'good' | 'understandable' | 'almost' | 'needs_work';

export type PlayerState =
  | 'idle' | 'playing' | 'prompting' | 'recording'
  | 'processing' | 'feedback' | 'asking' | 'answering' | 'complete';

export type PlayerVariant = 'orb' | 'editorial' | 'conversation';

export interface Mistake {
  id: string;
  lessonId: string;
  promptText: string;
  promptAudioUrl?: string;
  expectedAnswer: string;
  acceptableAnswers: string[];
  userTranscript: string;
  feedback: FeedbackKind;
  category: MistakeCategory;
  severity: 1 | 2 | 3;
  responseTimeMs: number;
  retried: boolean;
  eventuallyCorrect: boolean;
  replayAudioRef?: string;
  createdAt: Date;
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  level: string;
  scenario: string;
  focus: string;
  score: number;
  mistakes: number;
  date: string;
  outline: OutlineSection[];
  prompts: Prompt[];
}

export interface OutlineSection {
  n: number;
  label: string;
  pct: number;
}

export interface Prompt {
  id: number;
  kind: 'translate' | 'answer' | 'roleplay';
  cue: string;
  es: string;
  userSays: string;
  status: FeedbackKind | 'good';
  note: string;
  t: number;
}

export interface BuilderState {
  scenario: string | 'auto';
  focus: string | 'auto';
  mistakes: string[];
  grammar: string[];
  diffOffset: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  length: 10 | 15 | 25 | 40;
  custom: string;
}

export type ComfortLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface ProfileState {
  name: string;
  comfortLevel: ComfortLevel | null;
  level: string;
  lessonsCompleted: number;
  streak: number;
  totalSpeaking: string;
  lastLessonAt: string;
  settings: {
    dialect: 'rioplatense';
    explanations: 'minimal' | 'moderate' | 'detailed';
    defaultLength: 10 | 15 | 25 | 40;
    defaultDifficultyOffset: number;
    showTranscriptByDefault: boolean;
    showTranslationByDefault: boolean;
    playbackSpeed: number;
  };
}

export interface ResponseToken {
  t: string;
  kind: 'ok' | 'wrong';
  issue?: string;
  cat?: string;
}
