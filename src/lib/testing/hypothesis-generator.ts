import OpenAI from 'openai';
import { QUESTION_BANK } from '@/lib/question-bank';
import type { Question } from '@/lib/types';
import type { ScenarioCategory, GradeLabel, TargetArea } from './types';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export interface ScenarioPlan {
  name: string;
  category: ScenarioCategory;
  promptTypePreference: string;
  difficultyRange: [number, number];
  responseToGenerate: string;
  expectedLabel: GradeLabel;
  expectedErrorCategories: string[];
  rationale: string;
  voice: 'spanish' | 'english';
}

export interface HypothesisResult {
  hypothesis: string;
  scenarios: ScenarioPlan[];
}

export function selectQuestion(
  promptTypePreference: string,
  difficultyRange: [number, number],
  excludeIds: string[]
): Question | null {
  const [minD, maxD] = difficultyRange;
  let candidates = QUESTION_BANK.filter(
    (q) =>
      !excludeIds.includes(q.prompt_id) &&
      q.difficulty_score >= minD &&
      q.difficulty_score <= maxD &&
      q.prompt_type === promptTypePreference
  );

  if (candidates.length === 0) {
    // Relax type constraint
    candidates = QUESTION_BANK.filter(
      (q) =>
        !excludeIds.includes(q.prompt_id) &&
        q.difficulty_score >= minD &&
        q.difficulty_score <= maxD
    );
  }

  if (candidates.length === 0) {
    // Relax difficulty constraint
    candidates = QUESTION_BANK.filter((q) => !excludeIds.includes(q.prompt_id));
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function generateHypothesis(
  instructions: string,
  targetArea: TargetArea
): Promise<HypothesisResult> {
  const availableTypes = [...new Set(QUESTION_BANK.map((q) => q.prompt_type))].join(', ');
  const diffMin = Math.min(...QUESTION_BANK.map((q) => q.difficulty_score)).toFixed(1);
  const diffMax = Math.max(...QUESTION_BANK.map((q) => q.difficulty_score)).toFixed(1);

  const SYSTEM = `You are a QA engineer testing an Argentine Spanish language learning app. The app uses OpenAI Whisper for transcription and GPT for grading spoken Spanish responses on dimensions: comprehension, task_completion, grammar, vocabulary, fluency, pronunciation_intelligibility, response_speed, target_style_alignment. Scores map: 0=Ouch, 1=Bad, 2=Ok, 3=Good, 4-5=Excellent.

Available prompt types: ${availableTypes}
Difficulty score range: ${diffMin}–${diffMax} (low = beginner A1, high = advanced C1)

Generate a testing hypothesis and 4–6 specific test scenarios. For each scenario, specify the exact text to be converted to speech as the "learner's response". Include a mix of correct and incorrect responses.

For wrong_language scenarios: use English text as responseToGenerate and set voice="english".
For all other scenarios: use Spanish text and set voice="spanish".

Return only valid JSON:
{
  "hypothesis": "what you expect to find and why",
  "scenarios": [
    {
      "name": "short scenario name",
      "category": "correct|wrong_language|bad_grammar|incomplete|slow|wrong_answer|silence",
      "promptTypePreference": "preferred prompt type from the available list",
      "difficultyRange": [min_float, max_float],
      "responseToGenerate": "exact text to TTS as learner response",
      "expectedLabel": "Excellent|Good|Ok|Ouch|Bad",
      "expectedErrorCategories": ["category1"],
      "rationale": "why this scenario tests something meaningful",
      "voice": "spanish|english"
    }
  ]
}`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    max_tokens: 2000,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Target area: ${targetArea}\n\nInstructions: ${instructions}`,
      },
    ],
  });

  const result = JSON.parse(completion.choices[0].message.content ?? '{}');
  return {
    hypothesis: result.hypothesis ?? 'No hypothesis generated',
    scenarios: (result.scenarios ?? []).map((s: ScenarioPlan) => ({
      ...s,
      voice: s.voice ?? (s.category === 'wrong_language' ? 'english' : 'spanish'),
    })),
  };
}
