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
  audioSpeed?: number; // 1.0 = normal; only set for 'slow' category
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

GRADING RUBRIC — use this to set realistic expectedLabel values:
- Score 5/4 → "Excellent": correct, complete, natural, minimal errors
- Score 3 → "Good": on-topic and understandable, noticeable but minor errors, core task accomplished
- Score 2 → "Ok": addresses the prompt partially, major gaps or errors but intent is clear
- Score 1 → "Bad": attempted but meaning mostly missing, fails to address the prompt, or barely intelligible
- Score 0 → "Ouch": no meaningful response, completely off-topic, or total non-answer

KEY RULE: A response that answers the core task (even without polite framing or perfect grammar) still scores 3 "Good". Only score "Bad" or "Ouch" when the response fundamentally FAILS to address the prompt.

The grading API uses ONLY these exact error category names — use them verbatim in expectedErrorCategories:
no_response, skipped, misunderstood_prompt, incomplete_answer, wrong_meaning, grammar,
verb_conjugation, tense_error, ser_estar, por_para, gender_agreement, number_agreement,
word_order, missing_pronoun, object_pronoun, preposition, vocabulary_gap, unnatural_wording,
pronunciation, response_speed, target_style_vos, target_style_vocabulary,
target_style_pronunciation, too_much_english, hallucinated_or_unrelated_answer

For wrong_language scenarios: expectedLabel="Ouch", expectedErrorCategories=["too_much_english"]
For bad_grammar scenarios: expectedLabel="Ok" or "Bad" depending on severity, expectedErrorCategories=["grammar"] or ["verb_conjugation"]
For incomplete scenarios: expectedLabel="Bad" ONLY if the response misses the core task entirely; use "Ok" if it partially addresses it
For wrong_answer scenarios: expectedLabel="Bad" or "Ouch", expectedErrorCategories=["hallucinated_or_unrelated_answer"]
For slow scenarios: set audioSpeed to a specific value to test different gradations of slowness:
  - audioSpeed=0.5 → very slow (should grade response_speed=1 or 2), expectedLabel="Ok"
  - audioSpeed=0.7 → noticeably slow (should grade response_speed=2 or 3), expectedLabel="Good" or "Ok"
  - audioSpeed=0.85 → slightly slow (borderline, response_speed=3 or 4), expectedLabel="Good"
  Include at least 2 slow scenarios at different speeds when testing slowness. Always set expectedErrorCategories=["response_speed"].

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
      "expectedErrorCategories": ["use_exact_category_names_from_list"],
      "rationale": "why this scenario tests something meaningful",
      "voice": "spanish|english",
      "audioSpeed": 1.0
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
