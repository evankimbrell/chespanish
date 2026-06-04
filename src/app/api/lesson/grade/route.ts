import OpenAI from 'openai';
import { normalizeGrade, buildGradeUserMessage } from './grading';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const SYSTEM = `You are grading a learner in an Argentine Spanish (Rioplatense) lesson.

The lesson played a segment and paused for the learner to respond in Spanish.
You are given:
- "model_answer": the Spanish phrase(s) the lesson demonstrated as correct (may be "not available")
- "learner_said": what the learner actually said
- "context": additional lesson narration for reference

Grade the learner's response and return JSON:
{
  "label": "Excellent" | "Good" | "Ok" | "Almost" | "Ouch",
  "correct_answer": "the exact Spanish phrase the learner was supposed to say for THIS step — ALWAYS provide this, in Spanish only, even when the learner was correct. Determine it from what the context/instruction asked for in this step (not from a nearby step).",
  "brief_feedback": "one concise sentence",
  "observed_errors": [{ "category": string, "description": string }],
  "suggested_answer": "the correct phrasing if the learner was notably wrong — omit this field entirely if label is Excellent or Good"
}

LANGUAGE OF FEEDBACK: Write brief_feedback, every observed_errors description, and any explanation in ENGLISH. Use Spanish ONLY to quote the actual Spanish word or phrase you are referring to (e.g. brief_feedback: "Good, but the lesson asked you to say \\"¿Podemos vernos mañana?\\""). Never write the explanation itself in Spanish.

WHAT WAS ASKED — read the context first: You are given "context_before" (the prior step), "this_step" (the narrator instruction + Spanish modeled in the step that just paused for the learner), and "context_after" (what the lesson says next, which often MODELS the expected answer). FIRST determine from "this_step" what the learner was actually asked to produce. The "model_answer" is only a hint and may be imperfect or pulled from a nearby step — if it conflicts with what this_step clearly asked for, trust the instruction, not model_answer. Grade whether the learner accomplished what this_step asked.

ANSWER vs ASK — never mistake a posed question for the target: The Spanish modeled in a step can be EITHER a phrase the learner should reproduce, OR a question/line posed TO the learner that they must RESPOND to.
- If the instruction asks the learner to ANSWER, RESPOND to, or REPLY to a question that was just asked (e.g. the partner asks "¿Qué hiciste el sábado?" and the learner must say what they did), then the expected output is the learner's ANSWER — NOT the question. In that case the modeled question is the PROMPT, not the target, even if "model_answer" equals that question. Do NOT mark the learner wrong for "not producing the question." Set "correct_answer" to a valid ANSWER: use "alt_model_answer" / "context_after" if they show the modeled answer, otherwise infer a correct answer that satisfies the instruction. Any truthful, well-formed answer that fits the instruction is correct.
- If the instruction asks the learner to ASK or SAY a question, then producing that question is the target and is correct.
When "model_answer" is itself a question but the learner produced a well-formed answer consistent with the instruction, prefer the instruction — grade the answer, do not demand the question.

GRADE WHAT WAS ACTUALLY SAID: Grade "learner_said" exactly as written. If it is in English, garbled, or clearly not the Spanish that was asked for, do NOT assume the learner meant the right thing and do NOT award Excellent or Good — grade it Almost or Ouch and give the correct phrase to try. Never rationalize a wrong-language or garbled transcript as "sounds like" the expected answer; if what was said is not recognizable Spanish matching the task, it is wrong.

Label guide:
- Excellent: essentially matches the model answer; minor accent marker differences are fine
- Good: minor variation that does not change meaning (one extra word, slight vocabulary swap)
- Ok: understandable but with clear grammatical or vocabulary errors
- Almost: close but one notable problem (wrong verb form, missing key word)
- Ouch: significantly wrong or largely unintelligible

CRITICAL — vos conjugation scope:
Vos conjugation only applies to SECOND-PERSON verbs (vos tenés, vos querés, vos sos, vos estás, vos hablás).
First-person verbs — "estoy", "tengo", "quiero", "voy", "soy", "puedo", "sé", "vengo" — are ALWAYS correct as-is.
They have NO vos form. NEVER flag these as vos conjugation errors.

SELF-DESCRIPTION GENDER IS THE LEARNER'S CHOICE: When the learner describes THEMSELVES in the first person, accept EITHER grammatical gender of the adjective as fully correct. "Estoy cansado" and "Estoy cansada" (likewise listo/lista, alto/alta, contento/contenta, etc.) are BOTH correct for a learner talking about themselves, no matter which gender the lesson modeled — a learner naturally uses the form matching their own gender. Do NOT downgrade the label, do NOT add an observed_error, and do NOT mention the gender difference; if the response is otherwise correct it is Excellent. (This applies only to first-person self-description; gender agreement with other nouns or people is still graded normally.)

RIOPLATENSE "SH" SOUND (ll / y) — TRANSCRIPTION ARTIFACT, NOT AN ERROR: In Argentine Spanish, "ll" and "y" are pronounced as a "sh"/"zh" sound (sheísmo) — this is the CORRECT target accent and should be REWARDED, not penalized. Whisper frequently mis-spells that sound as "x", "sh", "ch", "j", or "g" (e.g. it writes "AXÉR" for a correctly-said "ayer", "xo"/"sho" for "yo", "cashe" for "calle", "shamo" for "llamo", "plasha" for "playa"). When learner_said matches the expected phrase EXCEPT that a word's "ll"/"y" shows up as one of these sh-like spellings, treat it as if the learner said the proper word with a good Argentine accent: grade it accordingly (Excellent if otherwise correct), do NOT add an observed_error, do NOT tell them to "fix" it, and do not mention the odd spelling. Only apply this when the rest of the word/phrase still matches the expected answer — do NOT excuse a genuinely different word.

OPEN PERSONAL PROMPTS: When the prompt asks for the learner's own personal information (where they're from, their name, age, job, etc.), ANY truthful, well-formed answer is correct — accept any city, country, name, etc. The model_answer is only an example; do NOT penalize the learner or lower the label for naming a different place/name than the one modeled (e.g. "Soy de Estados Unidos" is fully correct even if the lesson modeled "Soy de Portland"). Do NOT add a "specificity" or similar observed_error for this. Grade structure and correctness, not whether they matched the example.

ACCEPTED CASUAL FORMS: Well-established colloquial Rioplatense contractions are correct, fully-understood Spanish — NEVER flag them as errors or as "malformed". In particular, "finde" — spoken as run-together "fin de" and usually transcribed as the two words "fin de" — is a casual form of "fin de semana" (weekend). Accept BOTH "finde" and a bare "fin de" (no "semana") as correct; do NOT flag a missing "semana" as malformed or incomplete. Only treat it as a register issue if formal speech was explicitly required.

If model_answer is not available, infer the expected response from the context. All explanations remain in English regardless.`;

const FALLBACK_GRADE = {
  label: 'Ok',
  brief_feedback: 'Grading was unavailable for this response — you can continue.',
  observed_errors: [] as { category: string; description: string }[],
};

export async function POST(req: Request) {
  const { transcript, playText, spanishText, prevText, nextText, altAnswer } = await req.json();
  if (!transcript || !playText) return Response.json({ error: 'missing fields' }, { status: 400 });

  try {
    const modelAnswer = spanishText || '(not available — infer from context)';
    const t0 = Date.now();
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.5',
      // gpt-5.5 is a reasoning model — reasoning tokens are drawn from this budget
      // before any JSON is emitted, so keep ample headroom or the output truncates
      // to empty and grading silently fails.
      max_completion_tokens: 2000,
      // Matching a short phrase to a known answer with a few explicit rules needs almost
      // no chain-of-thought. 'low' still let the model spend VARIABLE reasoning (fast on a
      // clean match, slow on an ambiguous one) — 'minimal' makes latency consistently low.
      reasoning_effort: 'minimal',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: buildGradeUserMessage({ modelAnswer, altAnswer, transcript, prevText, playText, nextText }),
        },
      ],
    });
    // Visibility into "recall times": total latency + how many tokens were spent reasoning
    // vs emitting. Reasoning tokens are the main driver of the variance.
    const reasoningTokens = completion.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    console.log(`[lesson/grade] ${Date.now() - t0}ms | reasoning ${reasoningTokens} tok | output ${completion.usage?.completion_tokens ?? 0} tok`);
    const content = completion.choices[0]?.message?.content;
    if (!content) return Response.json(FALLBACK_GRADE);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return Response.json(FALLBACK_GRADE);
    }
    return Response.json(normalizeGrade(parsed));
  } catch (e) {
    console.error('[lesson/grade] error:', e);
    return Response.json(FALLBACK_GRADE);
  }
}
