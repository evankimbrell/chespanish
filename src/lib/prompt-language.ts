// Most lesson prompts want a Spanish response, so recording forces Whisper to Spanish.
// But some steps (listening-comprehension checks) explicitly ask the learner to answer
// IN ENGLISH. For those, forcing Spanish makes Whisper render the spoken English as
// Spanish — so we must detect the instruction and let Whisper expect English instead.
export function expectsEnglishResponse(playText: string | undefined | null): boolean {
  if (!playText) return false;
  const t = playText.toLowerCase();
  return /\bin english\b/.test(t) || t.includes('en inglés') || t.includes('en ingles');
}
