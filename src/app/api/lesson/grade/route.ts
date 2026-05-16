import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const SYSTEM = `You are grading a learner in an Argentine Spanish (Rioplatense) lesson.
The learner heard a Pimsleur-style lesson segment and was asked to respond in Spanish.
Given the lesson text and the learner's spoken response, return JSON:
{
  "label": "Excellent" | "Good" | "Ok" | "Almost" | "Ouch",
  "brief_feedback": "one concise sentence",
  "observed_errors": [{ "category": string, "description": string }]
}
Label guide: Excellent = perfect, Good = minor issues only, Ok = understandable with clear errors, Almost = close but one notable problem, Ouch = significant difficulty.
observed_errors should be empty [] when label is Excellent or Good with no real issues.
Focus on: correct vos conjugation, vocabulary choice, word order, pronunciation approximation.`;

export async function POST(req: Request) {
  const { transcript, playText } = await req.json();
  if (!transcript || !playText) return Response.json({ error: 'missing fields' }, { status: 400 });

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Lesson segment: "${playText}"\nLearner said: "${transcript}"` },
      ],
    });
    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
