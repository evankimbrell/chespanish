import type { TestReport } from './types';

// Pure helpers for generating the NEXT lesson's design brief from (A) a condensed
// placement-test diagnosis and (B) the first completed lesson's report. Kept free of
// the OpenAI SDK so they can be unit-tested; lesson-design.ts wraps the model call.

interface StoredReport {
  testReport?: TestReport | null;
  educatorReport?: string;
}

// Shrink the (large) stored level-test report down to the diagnosis that matters for
// planning the next lesson. Prefers the structured TestReport; falls back to a truncated
// educator report, then a placeholder.
export function condenseLevelTestReport(report: StoredReport | null | undefined): string {
  const tr = report?.testReport;
  if (tr) {
    const lines: string[] = [];
    lines.push(`Level: ${tr.display_level}${tr.cefr_band ? ` (${tr.cefr_band})` : ''}; overall ${tr.overall_score}/100, confidence ${tr.confidence}.`);
    if (tr.summary) lines.push(`Summary: ${tr.summary}`);
    if (tr.strengths?.length) lines.push(`Strengths: ${tr.strengths.join('; ')}.`);
    if (tr.weaknesses?.length) lines.push(`Weaknesses: ${tr.weaknesses.join('; ')}.`);
    if (tr.most_common_error_categories?.length) lines.push(`Most common error categories: ${tr.most_common_error_categories.join(', ')}.`);
    if (tr.next_level_gap) lines.push(`Gap to next level: ${tr.next_level_gap}`);
    const rec = tr.recommended_first_lesson;
    if (rec?.title) lines.push(`Originally recommended first lesson: "${rec.title}"${rec.focus_points?.length ? ` (focus: ${rec.focus_points.join(', ')})` : ''}.`);
    return lines.join('\n');
  }
  const edu = report?.educatorReport?.trim();
  if (edu) return edu.length > 1500 ? `${edu.slice(0, 1500)}…` : edu;
  return 'No placement test data available for this student.';
}

// Glue the two reports into one clearly-labelled block for the brief prompt.
export function buildCombinedReport(condensedLevelTest: string, firstLessonReport: string): string {
  return (
    `(A) CONDENSED PLACEMENT DIAGNOSIS — what we originally identified to work on:\n${condensedLevelTest}\n\n` +
    `(B) FIRST LESSON REPORT — what the first lesson addressed and how the student performed:\n${firstLessonReport}`
  );
}

// Derive the next-lesson brief prompt from the existing first-lesson DESIGN_BRIEF_PROMPT,
// so the two stay in sync. Only the framing changes (the student has now completed a
// lesson); the section spec + JSON output format are inherited unchanged.
export function buildNextLessonBriefPrompt(basePrompt: string, combinedReport: string): string {
  return basePrompt
    .replace('[TEST_DATA]', combinedReport)
    .replace(
      'creating the first personalized audio lesson for a student after a Spanish level test.',
      "designing the student's NEXT personalized audio lesson. The student has already completed a Spanish placement test AND their first personalized lesson; you are given both the original placement diagnosis and a report on that first lesson.",
    )
    .replace('create a clear first-lesson design brief', 'create a clear next-lesson design brief')
    .replace('produce a first-lesson design brief with the following sections', 'produce a next-lesson design brief with the following sections')
    .replace(
      "Design the first lesson based on the student's actual level and highest-ROI next step. Do not simply spot-treat every error from the test. Instead, identify the most logical next lesson that would produce the best improvement in the student's real Spanish speaking ability.",
      "Design the NEXT lesson based on the student's current level and highest-ROI next step, building on what the first lesson already addressed. Treat recurring mistakes (issues seen in the placement test AND again in the first lesson) as high priority, move past what the student has now demonstrated they can do, and do NOT simply repeat the first lesson.",
    )
    .replace(
      'Here is the student information:',
      'You are given two inputs below: (A) a condensed placement diagnosis (the original plan) and (B) a report from the completed first lesson (score, what went well, and mistakes marked new vs recurring). Use BOTH to choose the next lesson.\n\nHere is the student information:',
    );
}
