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
  "brief_feedback": "one concise sentence",
  "observed_errors": [{ "category": string, "description": string }],
  "suggested_answer": "the correct phrasing if the learner was notably wrong — omit this field entirely if label is Excellent or Good"
}

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

ACCEPTED CASUAL FORMS: Well-established colloquial Rioplatense contractions are correct, fully-understood Spanish — NEVER flag them as errors or as "malformed". In particular, "finde" is a common casual form of "fin de semana" (weekend) and must be accepted as correct. Only treat such a form as a register issue if formal speech was explicitly required.

If model_answer is not available, infer the expected response from the context.`;

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
  const out: { label: string; brief_feedback: string; observed_errors: { category: string; description: string }[]; suggested_answer?: string } =
    { label, brief_feedback, observed_errors };
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
