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
  comprehension: number | null;
  task_completion: number | null;
  grammar: number | null;
  vocabulary: number | null;
  fluency: number | null;
  pronunciation_intelligibility: number | null;
  response_speed: number | null;
  target_style_alignment: number | null;
}

export interface ObservedError {
  category: string;
  description: string;
  severity: 1 | 2 | 3;
  correction?: string;
  review_later: boolean;
}

export interface SpeechMetrics {
  wpm: number;
  initial_silence_sec: number;
  max_pause_sec: number;
  notable_pause_count: number;  // pauses > 1s between words
  medium_pause_count: number;   // pauses > 0.5s between words
}

export interface GradeResult {
  prompt_id: string;
  overall_score: 0 | 1 | 2 | 3 | 4 | 5;
  label: 'Ouch' | 'Bad' | 'Ok' | 'Good' | 'Excellent';
  dimension_scores: GradeDimensions;
  cefr_signal: string;
  observed_errors: ObservedError[];
  brief_feedback: string;
  notes_for_profile: string[];
  speech_metrics?: SpeechMetrics;
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
  difficulty_score: number;           // Float 0–10 (e.g. 4.5 for A2+)
  difficulty_bucket: string;          // e.g. "A2_PLUS", "B1_MINUS"
  cefr_band: string;                  // e.g. "A2", "B1"
  skill_targets: string[];
  audio_text?: string;
  instruction_text: string;
  scenario?: string;
  response_language_allowed: 'spanish' | 'english_or_spanish';
  target_answer?: string;
  acceptable_response_examples: string[];
  strong_response_examples?: string[];
  partial_response_examples?: string[];
  failed_response_examples?: string[];
  expected_answer_behavior?: string;
  prompt_specific_grading_notes?: string[];
  dimension_weighting?: Partial<Record<keyof GradeDimensions, number>>;
  common_errors?: ObservedError[];
  scoring_guidance?: {
    score_5: string; score_4: string; score_3: string;
    score_2: string; score_1: string; score_0: string;
  };
  routing_notes?: { if_strong: string; if_okay: string; if_weak: string };
}

export interface SkillScores {
  listening_comprehension: number;
  speaking_fluency: number;
  grammar_control: number;
  vocabulary_range: number;
  pronunciation_intelligibility: number;
  response_speed: number;
  target_style_alignment: number;
  practical_communication: number;
}

export interface SkillCoverage {
  listening: number;
  speaking_production: number;
  open_speaking: number;
  roleplay_practical: number;
  grammar_structured: number;
  dialogue_monologue: number;
}

export interface TestEngineState {
  abilityEstimate: number;            // 0–10 float
  initialAbilityEstimate: number;
  nextTargetDifficulty: number;
  skillScores: SkillScores;
  askedIds: string[];
  recentTypes: PromptType[];
  consecutiveHighScores: number;      // score >= 3
  consecutiveLowScores: number;       // score <= 1
  promptCount: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceRange: [number, number];
  skillCoverage: SkillCoverage;
  lastUsedTranscriptHelp: boolean;
  lastWasSlow: boolean;
  lastWasSkipped: boolean;
}

export interface PromptResult {
  promptIndex: number;
  questionId: string;
  promptType: PromptType;
  promptDifficulty: number;
  promptBucket: string;
  promptText: string;
  transcript: string | null;
  usedTranscriptHelp: boolean;
  skipped: boolean;
  responseTimeSeconds: number;
  speakingDurationSeconds: number | null;
  wordsPerMinute: number | null;
  overallScore: number | null;
  evidenceScore: number | null;
  abilityEstimateBefore: number;
  abilityEstimateAfter: number;
  grade: GradeResult | null;
  briefFeedback: string;
}

export interface TestReport {
  overall_score: number;
  display_level: string;
  cefr_band: string;
  confidence: 'low' | 'medium' | 'high';
  confidence_range: [number, number];
  summary: string;
  skill_scores: SkillScores;
  strengths: string[];
  weaknesses: string[];
  most_common_error_categories: string[];
  next_level_gap: string;
  recommended_first_lesson: {
    title: string;
    scenario: string;
    focus_points: string[];
    why: string;
  };
  next_three_lessons: { title: string; target_difficulty: number; focus: string }[];
}

export interface LevelTestSession {
  startedAt: string;
  completedAt: string | null;
  comfortLevel: ComfortLevel | null;
  prompts: PromptResult[];
  report: TestReport | null;
}

export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface LessonPlay {
  audioUrl: string;
  promptAfter: boolean;
  text: string;
  spanishText?: string;        // Spanish voice segments only — the model answer
  wordTimings?: WordTiming[];  // absent for older cached plays
  sectionName?: string;        // absent for older cached plays
}

export interface PlayMeta {
  promptAfter: boolean;
  text: string;
  sectionName?: string;
}

export interface LessonGrade {
  label: 'Excellent' | 'Good' | 'Ok' | 'Almost' | 'Ouch';
  brief_feedback: string;
  observed_errors: { category: string; description: string }[];
  suggested_answer?: string;   // shown when label is not Excellent/Good
}

export interface LessonHistoryEntry {
  id: string;             // generatedAt — unique per generation
  title: string;
  transcript: string;
  startedAt: string;
  lastAccessedAt: string;
  playIdx: number;
  totalCount: number;
  completed: boolean;
  topics: string[];
}

export interface GeneratedLesson {
  transcript: string;
  plays: LessonPlay[];
  generatedAt: string;
  title: string;
  totalCount?: number;      // full parsed play count (may be > plays.length while loading)
  allPlayMeta?: PlayMeta[]; // lightweight metadata for all plays — no audio URLs
}
