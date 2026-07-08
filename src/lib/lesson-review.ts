import type { LessonGrade } from './types';

// A response captured during the current lesson session. Grading resolves in the
// background — the player never blocks on it — so `grade` is null while in flight.
// Client-session-only (the durable copy is the activity log).
export interface GradedResponse {
  id: number;            // monotonic per session — playIdx repeats if a prompt is re-answered
  playIdx: number;
  at: string;            // ISO timestamp of the response
  promptText: string;    // what the lesson asked (full play text)
  expected?: string;     // the modeled Spanish answer, if known
  transcript: string;    // what the learner said
  grade: LessonGrade | null; // null while grading is in flight
  gradeFailed?: boolean; // grading errored — no grade will ever arrive
}

// Labels that interrupt nothing mid-lesson but deserve a second look at the end.
// 'Ok' counts as "good enough" — it cruises straight through and sits in the
// clean list, matching the lesson philosophy: only clear misses demand review.
export function needsReview(label: LessonGrade['label'] | undefined): boolean {
  return label === 'Almost' || label === 'Ouch';
}

// Count shown in the player's subtle "N to review" chip. Pending/failed grades
// don't count — the chip must never accuse before the grade is in.
export function reviewCount(results: GradedResponse[]): number {
  return results.filter((r) => needsReview(r.grade?.label)).length;
}

// End-of-lesson layout: misses up top (in lesson order), everything else —
// clean passes, 'Ok's, still-grading and grading-failed items — below, also in
// lesson order. A late-resolving grade moves its item at most once.
export function splitForReview(results: GradedResponse[]): { review: GradedResponse[]; rest: GradedResponse[] } {
  const review: GradedResponse[] = [];
  const rest: GradedResponse[] = [];
  for (const r of results) (needsReview(r.grade?.label) ? review : rest).push(r);
  return { review, rest };
}

// The Spanish worth replaying for an item: the grader's answer for THAT response
// (never a neighbouring step's), falling back to the baked expected answer.
export function replayAnswer(r: GradedResponse): string | null {
  for (const t of [r.grade?.correct_answer, r.grade?.suggested_answer, r.expected]) {
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
}
