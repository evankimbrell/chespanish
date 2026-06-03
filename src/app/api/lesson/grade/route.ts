import OpenAI from 'openai';

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

WHAT WAS ASKED — read the context first: The "context" contains the narrator's instruction plus the Spanish that was modeled. FIRST determine from that context what the learner was actually asked to produce in THIS step. The "model_answer" is only a hint and may be imperfect or pulled from a nearby step — if it conflicts with what the context clearly asked for, trust the context, not model_answer. Grade whether the learner accomplished what THIS step asked.

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

ACCEPTED CASUAL FORMS: Well-established colloquial Rioplatense contractions are correct, fully-understood Spanish — NEVER flag them as errors or as "malformed". In particular, "finde" — spoken as run-together "fin de" and usually transcribed as the two words "fin de" — is a casual form of "fin de semana" (weekend). Accept BOTH "finde" and a bare "fin de" (no "semana") as correct; do NOT flag a missing "semana" as malformed or incomplete. Only treat it as a register issue if formal speech was explicitly required.

If model_answer is not available, infer the expected response from the context. All explanations remain in English regardless.`;

const VALID_LABELS = ['Excellent', 'Good', 'Ok', 'Almost', 'Ouch'];

// Always return a valid LessonGrade shape so the player never shows a blank
// feedback card or hangs on "Grading…", even if the model output is malformed.
function normalizeGrade(raw: unknown): {
  label: string;
  brief_feedback: string;
  observed_errors: { category: string; description: string }[];
  suggested_answer?: string;
} {
  const r = (raw ?? {}) as Record<string, unknown>;
  const label = typeof r.label === 'string' && VALID_LABELS.includes(r.label) ? r.label : 'Ok';
  const brief_feedback = typeof r.brief_feedback === 'string' ? r.brief_feedback : '';
  const observed_errors = Array.isArray(r.observed_errors)
    ? r.observed_errors
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e) => ({ category: String(e.category ?? 'note'), description: String(e.description ?? '') }))
    : [];
  const out: { label: string; brief_feedback: string; observed_errors: { category: string; description: string }[]; correct_answer?: string; suggested_answer?: string } =
    { label, brief_feedback, observed_errors };
  if (typeof r.correct_answer === 'string' && r.correct_answer.trim()) {
    out.correct_answer = r.correct_answer.trim();
  }
  if (typeof r.suggested_answer === 'string' && r.suggested_answer.trim()) {
    out.suggested_answer = r.suggested_answer;
  }
  return out;
}

const FALLBACK_GRADE = {
  label: 'Ok',
  brief_feedback: 'Grading was unavailable for this response — you can continue.',
  observed_errors: [] as { category: string; description: string }[],
};

export async function POST(req: Request) {
  const { transcript, playText, spanishText } = await req.json();
  if (!transcript || !playText) return Response.json({ error: 'missing fields' }, { status: 400 });

  try {
    const modelAnswer = spanishText || '(not available — infer from context)';
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.5',
      // gpt-5.5 is a reasoning model — reasoning tokens are drawn from this budget
      // before any JSON is emitted, so keep ample headroom or the output truncates
      // to empty and grading silently fails.
      max_completion_tokens: 2000,
      // Grading a short phrase against a known answer needs little reasoning. Low effort
      // keeps the model fast (~5-6s → ~1s) without hurting judgment on this simple task.
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `model_answer: "${modelAnswer}"\nlearner_said: "${transcript}"\ncontext: "${playText}"`,
        },
      ],
    });
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
