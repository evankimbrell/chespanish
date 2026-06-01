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
  audioSpeed?: number;        // 1.0 = normal; only set for 'slow' category
  deliberatePauses?: boolean; // inject explicit pause markers between phrases
}

export interface HypothesisResult {
  hypothesis: string;
  scenarios: ScenarioPlan[];
}

// Questions where English is explicitly allowed — cannot be used for wrong_language testing
const BILINGUAL_TYPES = new Set(['mini_dialogue_comprehension', 'listen_for_meaning', 'monologue_comprehension']);

function isCategoryCompatible(q: Question, category: ScenarioCategory): boolean {
  if (category === 'wrong_language') {
    // Don't use bilingual questions: English is a valid answer, so testing wrong_language is meaningless
    if (q.response_language_allowed === 'english_or_spanish') return false;
    if (BILINGUAL_TYPES.has(q.prompt_type)) return false;
  }
  return true;
}

export function selectQuestion(
  promptTypePreference: string,
  difficultyRange: [number, number],
  excludeIds: string[],
  category: ScenarioCategory = 'correct'
): Question | null {
  const [minD, maxD] = difficultyRange;
  let candidates = QUESTION_BANK.filter(
    (q) =>
      !excludeIds.includes(q.prompt_id) &&
      isCategoryCompatible(q, category) &&
      q.difficulty_score >= minD &&
      q.difficulty_score <= maxD &&
      q.prompt_type === promptTypePreference
  );

  if (candidates.length === 0) {
    // Relax type constraint
    candidates = QUESTION_BANK.filter(
      (q) =>
        !excludeIds.includes(q.prompt_id) &&
        isCategoryCompatible(q, category) &&
        q.difficulty_score >= minD &&
        q.difficulty_score <= maxD
    );
  }

  if (candidates.length === 0) {
    // Relax difficulty constraint
    candidates = QUESTION_BANK.filter(
      (q) => !excludeIds.includes(q.prompt_id) && isCategoryCompatible(q, category)
    );
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

Generate a testing hypothesis and 8–10 specific test scenarios. For each scenario, specify the exact text to be converted to speech as the "learner's response". Include a mix of correct and incorrect responses.

REQUIRED: Every test run must include 3–4 "observational" category scenarios (see OBSERVATIONAL ERROR SCENARIOS below). These test that the grader detects specific learner patterns without over-penalizing them.

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
target_style_pronunciation, too_much_english, hallucinated_or_unrelated_answer,
filled_pause, repetition_restart, false_start, article_omission, article_overuse,
subject_pronoun_overuse, subjunctive_error, conditional_error, negation_error,
false_cognate, calque, code_switching, register_error, discourse_markers,
response_shape, one_word_avoidance

CONSTRAINT: Never assign wrong_language to prompt types that allow English responses: mini_dialogue_comprehension, listen_for_meaning, monologue_comprehension. These questions explicitly allow English, so an English response is correct, not wrong. Only assign wrong_language to: say_it_in_spanish, roleplay_response, open_speaking, grammar_in_context, practical_problem, listen_and_respond.
For wrong_language scenarios: expectedLabel="Bad" (English response that understood the prompt scores Bad; only use "Ouch" if no comprehension is demonstrated), expectedErrorCategories=["too_much_english"]
For bad_grammar scenarios: expectedLabel="Ok" or "Bad" depending on severity, expectedErrorCategories=["grammar"] — always use "grammar" as the single expected category; the response generator independently decides which specific error type to introduce (conjugation, gender, tense, etc.) so don't predict the specific subcategory
For incomplete scenarios: ONLY use this category for prompts that have multiple required elements (e.g. "order a coffee AND say no sugar", "introduce yourself AND say where you're from", "ask for the bill AND say thank you"). A single-task prompt ("ask if they can give you a better price") cannot produce a meaningful incomplete response — the student either does it or doesn't. If the selected prompt is single-task, use wrong_answer or bad_grammar instead. expectedLabel="Ok" if the response partially addresses the prompt; "Bad" only if it misses the core task entirely.
For wrong_answer scenarios: expectedLabel="Bad" or "Ouch", expectedErrorCategories=["hallucinated_or_unrelated_answer"]
For slow scenarios: set audioSpeed and optionally deliberatePauses to test different gradations of slowness.
  NOTE: ElevenLabs speed range is 0.7–1.2 — NEVER request audioSpeed below 0.7.
  The grader uses two WPM tiers: <110 WPM = clearly slow (severity 2), 110–124 WPM = slightly below normal (severity 1). Natural conversational Spanish is 130–160 WPM.
  - audioSpeed=0.7 → very slow speech (~85–95 WPM), expectedLabel="Ok"
  - audioSpeed=0.8 → noticeably slow speech (~105–115 WPM), expectedLabel="Good" or "Ok"
  - audioSpeed=0.85 + deliberatePauses=true → borderline speed (~115–125 WPM) with hesitation pauses, expectedLabel="Good"
  - audioSpeed=0.9 → slightly below normal (~120–130 WPM), expectedLabel="Good" or "Excellent"
  Include at least 2 slow scenarios at different speeds/pause combinations when testing slowness. Always set expectedErrorCategories=["response_speed"].

OBSERVATIONAL ERROR SCENARIOS — include 3–4 of these per test run (REQUIRED). Set category="observational" for all of them. The responseToGenerate demonstrates a specific learner pattern. The expectedLabel reflects overall task quality — a response with one calque but otherwise correct Spanish should be "Excellent" or "Good"; the observational error alone must not cause Bad/Ouch. Examples of what to generate:
- article_omission: "Voy a tienda hoy" or "Me gusta café por la mañana" (missing required articles)
- subject_pronoun_overuse: "Yo voy al mercado. Yo compro pan. Yo regreso a casa." (repeating "yo" throughout)
- false_cognate: Use "actualmente" meaning "actually", or "realizar" to mean "realize", or "embarazada" in a context calling for embarrassed
- calque: "Hace sentido para mí" or "Quiero tener un buen tiempo" or "Estoy mirando para trabajo"
- code_switching: "Fui al store ayer" or "Necesito un bowl para la sopa" (English word mid-sentence)
- subjunctive_error: "Espero que viene mañana" (should be venga) or "Para que sabes la verdad" (should be sepas)
- negation_error: "Veo nada en la oscuridad" (missing "no") or "Como nunca carne" (word order)
- register_error: Use "tú" and very informal slang in a roleplay scenario addressing a boss or formal stranger
- discourse_markers: Generate a response with no connectors — each clause as a blunt separate statement with no pues/entonces/o sea/bueno
For observational scenarios, set expectedErrorCategories to the specific category being tested (e.g. ["calque"] or ["article_omission"]).

Return only valid JSON:
{
  "hypothesis": "what you expect to find and why",
  "scenarios": [
    {
      "name": "short scenario name",
      "category": "correct|wrong_language|bad_grammar|incomplete|slow|wrong_answer|silence|observational",
      "promptTypePreference": "preferred prompt type from the available list",
      "difficultyRange": [min_float, max_float],
      "responseToGenerate": "exact text to TTS as learner response",
      "expectedLabel": "Excellent|Good|Ok|Ouch|Bad",
      "expectedErrorCategories": ["use_exact_category_names_from_list"],
      "rationale": "why this scenario tests something meaningful",
      "voice": "spanish|english",
      "audioSpeed": 1.0,
      "deliberatePauses": false
    }
  ]
}`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    response_format: { type: 'json_object' },
    max_completion_tokens: 2000,
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
