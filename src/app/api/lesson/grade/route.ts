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

If model_answer is not available, infer the expected response from the context.`;

export async function POST(req: Request) {
  const { transcript, playText, spanishText } = await req.json();
  if (!transcript || !playText) return Response.json({ error: 'missing fields' }, { status: 400 });

  try {
    const modelAnswer = spanishText || '(not available — infer from context)';
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.5-mini',
      max_tokens: 350,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `model_answer: "${modelAnswer}"\nlearner_said: "${transcript}"\ncontext: "${playText}"`,
        },
      ],
    });
    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
