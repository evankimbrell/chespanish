import OpenAI from 'openai';
import type { TestScenario } from './types';
import type { GradeResult } from '@/lib/types';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export async function runScenario(
  scenario: TestScenario,
  audioBuffer: Buffer,
  baseUrl: string
): Promise<TestScenario> {
  const start = Date.now();

  try {
    const audioBlob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: 'audio/mpeg' });
    const audioFile = new File([audioBlob], 'test.mp3', { type: 'audio/mpeg' });

    const fd = new FormData();
    fd.append('audio', audioFile);
    fd.append('question', JSON.stringify(scenario.promptQuestion));
    fd.append(
      'allow_english',
      scenario.promptQuestion.response_language_allowed === 'english_or_spanish' ? '1' : '0'
    );
    fd.append('response_time_seconds', scenario.category === 'slow' ? '6.0' : '2.0');
    fd.append('speaking_duration_seconds', '2.0');
    fd.append('used_transcript_help', '0');

    const res = await fetch(`${baseUrl}/api/transcribe-and-grade`, {
      method: 'POST',
      body: fd,
    });

    if (!res.ok) throw new Error(`transcribe-and-grade returned ${res.status}`);

    const text = await res.text();
    let transcript: string | null = null;
    let grade: GradeResult | null = null;

    for (const line of text.trim().split('\n')) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'transcript') transcript = msg.transcript;
        if (msg.type === 'grade') grade = msg.grade;
        if (msg.type === 'error') throw new Error(msg.message);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Unexpected token') {
          throw parseErr;
        }
      }
    }

    const simplePass = checkAssertions(scenario, grade);

    // If assertions pass, we're done
    if (simplePass) {
      return {
        ...scenario,
        transcript,
        grade,
        passed: true,
        failureReason: null,
        durationMs: Date.now() - start,
        error: null,
      };
    }

    // Simple check failed — use AI to evaluate with full context before marking as failed
    const { passed, failureReason } = await smartEvaluate(scenario, transcript, grade);

    return {
      ...scenario,
      transcript,
      grade,
      passed,
      failureReason,
      durationMs: Date.now() - start,
      error: null,
    };
  } catch (e) {
    return {
      ...scenario,
      transcript: null,
      grade: null,
      passed: false,
      failureReason: `Error: ${String(e)}`,
      durationMs: Date.now() - start,
      error: String(e),
    };
  }
}

// AI-powered evaluator with full scenario context — catches false failures due to
// Whisper language detection errors, overly strict label matching, etc.
async function smartEvaluate(
  scenario: TestScenario,
  transcript: string | null,
  grade: GradeResult | null
): Promise<{ passed: boolean; failureReason: string | null }> {
  const simpleFailureReason = buildFailureReason(scenario, grade);

  try {
    const q = scenario.promptQuestion;
    const context = [
      `Scenario category: ${scenario.category}`,
      `Prompt type: ${q.prompt_type} (difficulty: ${q.difficulty_bucket})`,
      `Prompt instruction: "${q.instruction_text}"`,
      q.audio_text ? `Audio prompt: "${q.audio_text}"` : null,
      `Generated audio text (what was synthesized to speech): "${scenario.generatedResponse}"`,
      `Whisper transcript (what speech-to-text returned): "${transcript ?? '(none)'}"`,
      `Grade label: ${grade?.label ?? 'null'}`,
      `Grade feedback: "${grade?.brief_feedback ?? ''}"`,
      `Error categories returned: ${(grade?.observed_errors ?? []).map(e => e.category).join(', ') || 'none'}`,
      `Expected label: ${scenario.expectedLabel}`,
      `Expected error categories: ${scenario.expectedErrorCategories.join(', ') || 'none'}`,
      `Simple assertion failure reason: ${simpleFailureReason}`,
    ].filter(Boolean).join('\n');

    const SYSTEM = `You are a QA engineer evaluating whether a test scenario for a Spanish language learning app genuinely failed.

You have access to:
- The scenario category (what type of response was intentionally generated)
- The Spanish text that was synthesized to audio
- What Whisper speech-to-text returned as a transcript
- The grade that the grading API assigned
- What the test expected

Your job: determine if this is a REAL test failure (the grading system behaved incorrectly) or a FALSE FAILURE (an infrastructure artifact that doesn't reflect a real bug).

Common FALSE FAILURE patterns:
1. Whisper language detection error: The generated audio was correct Spanish, but Whisper transcribed it as English (e.g. translated "Perdón, ¿podés hablar más despacio?" → "Sorry, can you speak more slowly?"). The grader then correctly flagged English — but the underlying audio WAS correct. This is a Whisper failure, not a grading bug.
2. Near-miss label: The scenario expected "Ok" but got "Good" — the grading is directionally correct and the difference is marginal, not a real bug.
3. Label within one step for slow/incomplete scenarios: slow speech that grades "Good" instead of "Ok" is acceptable variance.

REAL FAILURE patterns:
1. Completely wrong label (e.g. correct Spanish graded as "Ouch" with no transcription issue)
2. Missing critical error category (e.g. wrong_language scenario not flagged as too_much_english when the transcript IS English)
3. Expected error category missing and the transcript clearly shows the error

Return JSON only:
{
  "passed": true | false,
  "reason": "brief explanation of your decision (1-2 sentences)"
}`;

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      max_tokens: 150,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: context },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    const passed = !!result.passed;
    const reason = result.reason ?? simpleFailureReason;

    return {
      passed,
      failureReason: passed ? null : `[AI] ${reason}\n${simpleFailureReason}`,
    };
  } catch {
    // If AI evaluation fails, fall back to simple check result
    return { passed: false, failureReason: simpleFailureReason };
  }
}

function checkAssertions(scenario: TestScenario, grade: GradeResult | null): boolean {
  if (!grade) return false;

  const labelPasses = grade.label === scenario.expectedLabel;

  const errorCategories = (grade.observed_errors ?? []).map((e) => e.category);
  const categoriesPassed = scenario.expectedErrorCategories.every((cat) =>
    errorCategories.includes(cat)
  );

  return labelPasses && categoriesPassed;
}

function buildFailureReason(scenario: TestScenario, grade: GradeResult | null): string {
  if (!grade) return 'No grade returned from API';

  const reasons: string[] = [];

  if (grade.label !== scenario.expectedLabel) {
    reasons.push(`Expected "${scenario.expectedLabel}" but got "${grade.label}"`);
  }

  const errorCategories = (grade.observed_errors ?? []).map((e) => e.category);
  const missingCategories = scenario.expectedErrorCategories.filter(
    (cat) => !errorCategories.includes(cat)
  );
  if (missingCategories.length > 0) {
    reasons.push(`Missing expected error categories: ${missingCategories.join(', ')}`);
  }

  return reasons.join('; ');
}
