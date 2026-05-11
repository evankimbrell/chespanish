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

export interface GradeDimensions {
  comprehension: number;
  task_completion: number;
  grammar: number;
  vocabulary: number;
  fluency: number;
  pronunciation_intelligibility: number;
  response_speed: number;
  target_style_alignment: number;
}

export interface ObservedError {
  category: string;
  description: string;
  severity: 1 | 2 | 3;
  correction?: string;
  review_later: boolean;
}

export interface GradeResult {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: 'Ouch' | 'Bad' | 'Ok' | 'Good' | 'Excellent';
  feedback: string;
  dimensions: GradeDimensions;
  observed_errors: ObservedError[];
  cefr_signal: string;
  next_question_recommendation: 'much_easier' | 'easier' | 'same' | 'harder' | 'much_harder';
}

export type PromptType =
  | 'listen_and_respond'
  | 'say_it_in_spanish'
  | 'listen_for_meaning'
  | 'mini_dialogue_comprehension'
  | 'monologue_comprehension'
  | 'roleplay_response'
  | 'open_speaking'
  | 'practical_problem'
  | 'grammar_in_context';

export interface Question {
  prompt_id: string;
  prompt_type: PromptType;
  difficulty_band: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  difficulty_score: number;
  skill_targets: string[];
  audio_text?: string;
  instruction_text: string;
  scenario?: string;
  target_answer?: string;
  acceptable_response_examples: string[];
  expected_answer_behavior?: string;
  scoring_notes?: string;
}

export interface TestEngineState {
  currentDifficulty: number;
  askedIds: string[];
  recentTypes: PromptType[];
  skillCoverage: Record<string, number>;
  consecutiveHighScores: number;
  consecutiveLowScores: number;
  promptCount: number;
}

export interface ResponseToken {
  t: string;
  kind: 'ok' | 'wrong';
  issue?: string;
  cat?: string;
}

export interface PromptMetric {
  promptIndex: number;
  questionId: string;
  promptType: PromptType;
  promptText: string;
  transcript: string | null;
  skipped: boolean;
  responseLatencyMs: number;
  speechOnsetMs: number | null;
  recordingDurationMs: number | null;
  wordsPerMinute: number | null;
  grade: GradeResult | null;
}

export interface LevelTestSession {
  startedAt: string;
  completedAt: string | null;
  comfortLevel: ComfortLevel | null;
  prompts: PromptMetric[];
}
