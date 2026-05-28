import type { Question, GradeResult } from '@/lib/types';

export type ScenarioCategory =
  | 'correct'
  | 'wrong_language'
  | 'bad_grammar'
  | 'incomplete'
  | 'slow'
  | 'wrong_answer'
  | 'silence';

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
