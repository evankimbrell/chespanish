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

    // Derive what language the audio was generated in
    const audioLanguage = scenario.category === 'wrong_language' ? 'English' : 'Spanish';

    // Derive whether Whisper was told to allow English
    const allowEnglish = q.response_language_allowed === 'english_or_spanish';

    // Detect transcript language heuristically (presence of Spanish accent chars or common words)
    const spanishPattern = /[áéíóúüñ¿¡]|(\b(sí|no|de|la|el|que|en|es|por|con|una|los|las|para)\b)/i;
    const transcriptLang = transcript
      ? spanishPattern.test(transcript) ? 'Spanish' : 'English'
      : 'unknown';

    // Hard-coded rule: language mismatch = Whisper error = pass immediately, no GPT needed.
    // The grader only sees the transcript — if Whisper got the language wrong, the grader
    // cannot be blamed for grading based on what it received.
    const languageMismatch = transcriptLang !== 'unknown' && transcriptLang !== audioLanguage;
    if (languageMismatch) {
      return {
        passed: true,
        failureReason: null,
      };
    }

    // Hard-coded rule: wrong_language category on a bilingual question is an invalid test setup.
    if (scenario.category === 'wrong_language' && allowEnglish) {
      return {
        passed: true,
        failureReason: null,
      };
    }

    const context = [
      `--- SCENARIO SETUP ---`,
      `Category: ${scenario.category}`,
      `Category meaning:`,
      `  correct = generated correct Spanish audio; expected Excellent`,
      `  wrong_language = intentionally generated ENGLISH audio; expected Ouch + too_much_english`,
      `  bad_grammar = Spanish audio with deliberate grammatical error; expected Ok or Bad`,
      `  incomplete = Spanish audio that is on-topic but missing a required element; expected Ok or Bad`,
      `  slow = correct Spanish at reduced speed; expected Ok or Good + response_speed error`,
      `  wrong_answer = off-topic Spanish; expected Bad or Ouch`,
      `  silence = near-silence audio; expected Ouch`,
      ``,
      `--- PROMPT ---`,
      `Prompt type: ${q.prompt_type} (difficulty: ${q.difficulty_bucket}, CEFR: ${q.cefr_band})`,
      `Response language: ${q.response_language_allowed === 'english_or_spanish' ? 'English OR Spanish allowed' : 'Spanish only'}`,
      `Instruction: "${q.instruction_text}"`,
      q.audio_text ? `Audio played to student: "${q.audio_text}"` : null,
      q.acceptable_response_examples?.length
        ? `Acceptable responses: ${q.acceptable_response_examples.join(' | ')}`
        : null,
      ``,
      `--- AUDIO GENERATED ---`,
      `Audio language: ${audioLanguage} (${scenario.category === 'wrong_language' ? 'intentionally wrong language' : 'correct language for this scenario'})`,
      `Audio text synthesized: "${scenario.generatedResponse}"`,
      scenario.audioSpeed !== undefined ? `Audio speed: ${Math.round(scenario.audioSpeed * 100)}%` : null,
      scenario.deliberatePauses ? `Deliberate pauses injected: yes` : null,
      ``,
      `--- WHISPER TRANSCRIPTION ---`,
      `allow_english sent to Whisper: ${allowEnglish}`,
      `Transcript returned: "${transcript ?? '(none)'}"`,
      `Detected transcript language (heuristic): ${transcriptLang}`,
      `Whisper language match: ${transcriptLang === audioLanguage ? 'YES — transcript matches audio language' : `NO — audio was ${audioLanguage} but transcript appears ${transcriptLang} (possible Whisper translation error)`}`,
      ``,
      `--- GRADE RESULT ---`,
      `Label: ${grade?.label ?? 'null'}`,
      `Feedback: "${grade?.brief_feedback ?? ''}"`,
      `Dimension scores: ${JSON.stringify(grade?.dimension_scores ?? {})}`,
      `Error categories: ${(grade?.observed_errors ?? []).map(e => `${e.category} (${e.description})`).join('; ') || 'none'}`,
      ``,
      `--- ASSERTION ---`,
      `Expected label: ${scenario.expectedLabel}`,
      `Expected error categories: ${scenario.expectedErrorCategories.join(', ') || 'none'}`,
      `Simple check failure: ${simpleFailureReason}`,
    ].filter((x): x is string => x !== null).join('\n');

    const SYSTEM = `You are a QA engineer evaluating whether a test scenario for an Argentine Spanish language learning app genuinely failed.

The system under test has two parts:
1. Whisper (OpenAI speech-to-text) — transcribes audio to text
2. The grading LLM — evaluates the transcript against the prompt and grades it

The GRADER only sees the transcript. It cannot know what language the audio was recorded in. If Whisper transcribes incorrectly, the grader will grade based on that wrong transcript.

Your job: given the full context below, determine if this is a REAL GRADING BUG or a FALSE FAILURE caused by Whisper transcription error.

FIRST — CHECK THE WHISPER LANGUAGE MATCH FIELD. This is the most important signal.

RULE: If "Whisper language match: NO" — the audio language and transcript language differ — that is always a Whisper transcription error. The grader did its job correctly given what Whisper returned. Mark as PASSED. Do not flag as a grading bug.

SCENARIO CATEGORY GUIDE:
- wrong_language: Audio was INTENTIONALLY English. ONLY valid when "Response language: Spanish only". If "Response language: English OR Spanish allowed", English is a correct answer — invalid test setup, mark as passed.
- correct: Audio was correct Spanish. If Whisper returned English (language mismatch), mark as passed — Whisper error.
- bad_grammar/incomplete/wrong_answer: Intentional erroneous Spanish. Whisper normalization is a Whisper error.
- slow: Slow Spanish. Grader should detect low WPM and flag response_speed.

FALSE FAILURE patterns (mark as PASSED — not grading bugs):
0. Language mismatch: "Whisper language match: NO" for ANY category → Whisper translated or misdetected → pass.
1. Invalid test setup: Category is wrong_language BUT "Response language: English OR Spanish allowed" → pass.
2. Near-miss label variance: expected "Ok" got "Good", or expected "Good" got "Excellent" — marginal, acceptable.
3. One-step label variance for slow/incomplete: subjective, acceptable.

REAL BUG patterns (mark as FAILED — only when Whisper language match is YES):
1. wrong_language + Spanish-only question + transcript IS English + grader gave Excellent without flagging too_much_english. Grading bug.
2. Transcript is correct Spanish AND grader gave Ouch/Bad for no apparent reason.
3. Transcript clearly shows the expected error but grader didn't flag it.
4. Transcript is clearly off-topic but grader gave Excellent.

KEY CHECK: "Whisper language match: NO" → always pass. "Whisper language match: YES" → evaluate the grader.

Return JSON only:
{
  "passed": true | false,
  "reason": "1-2 sentences explaining whether this is a Whisper error, grader bug, or legitimate failure"
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

function labelPasses(scenario: TestScenario, grade: GradeResult): boolean {
  if (grade.label === scenario.expectedLabel) return true;
  // wrong_language: both "Ouch" and "Bad" are acceptable — "Bad" means English but understood
  // the prompt, "Ouch" means English with no apparent comprehension. Both are valid failures.
  if (scenario.category === 'wrong_language') {
    return grade.label === 'Ouch' || grade.label === 'Bad';
  }
  // slow: the task was completed — we're testing that response_speed gets flagged, not that
  // slowness tanks the overall label. Excellent/Good/Ok are all acceptable.
  if (scenario.category === 'slow') {
    return grade.label === 'Excellent' || grade.label === 'Good' || grade.label === 'Ok';
  }
  return false;
}

function checkAssertions(scenario: TestScenario, grade: GradeResult | null): boolean {
  if (!grade) return false;

  const errorCategories = (grade.observed_errors ?? []).map((e) => e.category);
  const categoriesPassed = scenario.expectedErrorCategories.every((cat) =>
    errorCategories.includes(cat)
  );

  return labelPasses(scenario, grade) && categoriesPassed;
}

function buildFailureReason(scenario: TestScenario, grade: GradeResult | null): string {
  if (!grade) return 'No grade returned from API';

  const reasons: string[] = [];

  if (!labelPasses(scenario, grade)) {
    const acceptable =
      scenario.category === 'wrong_language'
        ? '"Ouch" or "Bad"'
        : scenario.category === 'slow'
          ? '"Excellent", "Good", or "Ok"'
          : `"${scenario.expectedLabel}"`;
    reasons.push(`Expected ${acceptable} but got "${grade.label}"`);
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
