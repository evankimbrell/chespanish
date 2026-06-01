import type { Question, GradeResult, TestReport } from '@/lib/types';

export type ScenarioCategory =
  | 'correct'
  | 'wrong_language'
  | 'bad_grammar'
  | 'incomplete'
  | 'slow'
  | 'wrong_answer'
  | 'silence'
  | 'observational';

export type GradeLabel = 'Excellent' | 'Good' | 'Ok' | 'Ouch' | 'Bad';

export type TargetArea = 'level-test' | 'lesson-player' | 'grading' | 'full-flow';

export interface TestScenario {
  id: string;
  name: string;
  category: ScenarioCategory;
  promptQuestion: Question;
  generatedResponse: string;
  audioUrl: string;

  transcript: string | null;
  grade: GradeResult | null;

  expectedLabel: GradeLabel;
  expectedErrorCategories: string[];

  audioSpeed?: number;        // only set for 'slow' category; 1.0 = normal
  deliberatePauses?: boolean; // whether pause markers were injected into the text

  passed: boolean;
  failureReason: string | null;
  durationMs: number;
  error: string | null;
}

export interface Bug {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'grading' | 'ui' | 'transcription' | 'flow' | 'data';
  description: string;
  affectedScenarios: string[];
  suggestedFix: string;
  fixApplied: boolean;
  fixVerified: boolean;
}

export interface TestRun {
  id: string;
  createdAt: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  instructions: string;
  hypothesis: string;
  targetArea: TargetArea;
  scenarios: TestScenario[];
  bugs: Bug[];
  fixPlan: string | null;
  fixesApplied: boolean;
  verificationRun: string | null;
}

export interface SimulationPrompt {
  index: number;
  questionId: string;
  promptType: string;
  promptText: string;
  audioText?: string;
  difficulty: number;
  difficultyBucket: string;
  generatedResponse: string;
  audioUrl: string;
  transcript: string | null;
  grade: GradeResult | null;
  abilityBefore: number;
  abilityAfter: number;
  durationMs: number;
  error: string | null;
}

export interface StudentPersona {
  background: string;
  errorPatterns: string[];
  strengths: string[];
  speechStyle: string;
}

export interface SimulationRun {
  id: string;
  mode: 'simulation';
  createdAt: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  studentName: string;
  designatedLevel: string;
  comfortLevel: number;
  persona: StudentPersona | null;
  prompts: SimulationPrompt[];
  testReport: TestReport | null;
  educatorReport: string | null;
  suggestedLesson: {
    title: string;
    scenario: string;
    focus_points: string[];
    why: string;
  } | null;
  detectedLevel: string | null;
  levelAccurate: boolean | null;
}
