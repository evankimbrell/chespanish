import OpenAI from 'openai';
import type { TestScenario, Bug } from './types';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export async function analyzeResults(
  scenarios: TestScenario[],
  hypothesis: string
): Promise<{ bugs: Bug[]; fixPlan: string }> {
  const scenarioSummary = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    question: s.promptQuestion.instruction_text,
    promptType: s.promptQuestion.prompt_type,
    difficulty: s.promptQuestion.difficulty_score,
    responseGenerated: s.generatedResponse,
    expectedLabel: s.expectedLabel,
    actualLabel: s.grade?.label ?? 'N/A (no grade)',
    passed: s.passed,
    failureReason: s.failureReason,
    transcript: s.transcript,
    observedErrors: (s.grade?.observed_errors ?? []).map((e) => e.category),
    briefFeedback: s.grade?.brief_feedback ?? 'N/A',
    error: s.error,
  }));

  const passCount = scenarios.filter((s) => s.passed).length;
  const failCount = scenarios.filter((s) => !s.passed).length;

  const SYSTEM = `You are a QA analyst reviewing automated test results for an Argentine Spanish language learning app. The app uses OpenAI Whisper for transcription and GPT for grading spoken Spanish responses.

Analyze the test results and identify bugs — cases where grading or transcription behaved unexpectedly. Return JSON:
{
  "bugs": [
    {
      "id": "bug-1",
      "severity": "critical|high|medium|low",
      "category": "grading|ui|transcription|flow|data",
      "description": "clear description of what went wrong",
      "affectedScenarios": ["scenario-id"],
      "suggestedFix": "concrete actionable fix with file path if possible"
    }
  ],
  "fixPlan": "markdown text describing the overall fix strategy for all identified bugs"
}

Severity guide:
- critical: the app would crash or totally fail for users
- high: incorrect grading that misleads users
- medium: inconsistent behavior or edge case
- low: minor or cosmetic issue

If all tests passed, return { "bugs": [], "fixPlan": "All tests passed — no fixes needed." }`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    response_format: { type: 'json_object' },
    max_completion_tokens: 2000,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Hypothesis: "${hypothesis}"\n\nResults: ${passCount} passed, ${failCount} failed out of ${scenarios.length} total.\n\nDetailed Results:\n${JSON.stringify(scenarioSummary, null, 2)}`,
      },
    ],
  });

  const result = JSON.parse(completion.choices[0].message.content ?? '{"bugs":[],"fixPlan":""}');
  const bugs: Bug[] = (result.bugs ?? []).map(
    (b: Omit<Bug, 'fixApplied' | 'fixVerified'>) => ({
      ...b,
      fixApplied: false,
      fixVerified: false,
    })
  );

  return {
    bugs,
    fixPlan: result.fixPlan ?? '',
  };
}
