import type { TestScenario } from './types';
import type { GradeResult } from '@/lib/types';

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
    fd.append('response_time_seconds', '2.0');
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

    const passed = checkAssertions(scenario, grade);
    const failureReason = passed ? null : buildFailureReason(scenario, grade);

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
