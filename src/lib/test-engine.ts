import type { Question, TestEngineState, PromptType, ComfortLevel } from './types';

const COMFORT_TO_DIFFICULTY: Record<number, number> = {
  0: 1,
  1: 1,
  2: 3,
  3: 4,
  4: 6,
  5: 8,
};

const DELTA: Record<string, number> = {
  much_easier: -2,
  easier: -1,
  same: 0,
  harder: 1,
  much_harder: 2,
};

export function initEngine(comfortLevel: ComfortLevel | null): TestEngineState {
  return {
    currentDifficulty: COMFORT_TO_DIFFICULTY[comfortLevel ?? 1] ?? 1,
    askedIds: [],
    recentTypes: [],
    skillCoverage: {},
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
    promptCount: 0,
  };
}

export function selectNextQuestion(state: TestEngineState, bank: Question[]): Question | null {
  const available = bank.filter((q) => !state.askedIds.includes(q.prompt_id));
  if (available.length === 0) return null;

  const recentTypeSet = new Set<PromptType>(state.recentTypes.slice(-3) as PromptType[]);

  function candidatesAtRadius(radius: number): Question[] {
    return available.filter(
      (q) =>
        Math.abs(q.difficulty_score - state.currentDifficulty) <= radius &&
        !recentTypeSet.has(q.prompt_type),
    );
  }

  // Try exact match (radius 0), then ±1, ±2, then any (ignoring type rotation)
  let candidates =
    candidatesAtRadius(0) ||
    candidatesAtRadius(1) ||
    candidatesAtRadius(2);

  if (candidates.length === 0) candidates = candidatesAtRadius(0);
  if (candidates.length === 0) candidates = candidatesAtRadius(1);
  if (candidates.length === 0) candidates = candidatesAtRadius(2);
  if (candidates.length === 0) candidates = available; // last resort: any available

  // Prefer skills with lowest coverage count
  const scored = candidates.map((q) => {
    const coverageScore = q.skill_targets.reduce(
      (sum, skill) => sum + (state.skillCoverage[skill] ?? 0),
      0,
    );
    return { q, coverageScore };
  });

  scored.sort((a, b) => a.coverageScore - b.coverageScore);

  // Shuffle within the top tier (same coverage score as the best)
  const best = scored[0].coverageScore;
  const topTier = scored.filter((s) => s.coverageScore === best).map((s) => s.q);
  return topTier[Math.floor(Math.random() * topTier.length)];
}

export function updateEngine(
  state: TestEngineState,
  rec: string | null | undefined,
  score: number,
  lastQuestion: Question,
): TestEngineState {
  let newDiff = state.currentDifficulty + (DELTA[rec ?? 'same'] ?? 0);

  const isHigh = score >= 4;
  const isLow = score <= 1;
  const newHigh = isHigh ? state.consecutiveHighScores + 1 : 0;
  const newLow = isLow ? state.consecutiveLowScores + 1 : 0;

  if (newHigh >= 2) newDiff += 1;
  if (newLow >= 2) newDiff -= 1;

  newDiff = Math.max(1, Math.min(10, newDiff));

  const newCoverage = { ...state.skillCoverage };
  for (const skill of lastQuestion.skill_targets) {
    newCoverage[skill] = (newCoverage[skill] ?? 0) + 1;
  }

  return {
    currentDifficulty: newDiff,
    askedIds: [...state.askedIds, lastQuestion.prompt_id],
    recentTypes: [...state.recentTypes.slice(-2), lastQuestion.prompt_type],
    skillCoverage: newCoverage,
    consecutiveHighScores: newHigh,
    consecutiveLowScores: newLow,
    promptCount: state.promptCount + 1,
  };
}
