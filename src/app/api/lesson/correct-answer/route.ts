import OpenAI from 'openai';
import { CORRECT_ANSWER_SYSTEM, buildCorrectAnswerMessage } from '@/lib/correct-answer';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ answer: '' }, { status: 200 });
  let body: { playText?: string; prevText?: string; nextText?: string; altAnswer?: string; spanishText?: string; sectionName?: string };
  try { body = await req.json(); } catch { return Response.json({ answer: '' }, { status: 400 }); }
  if (!body.playText) return Response.json({ answer: '' }, { status: 400 });

  const userContent = buildCorrectAnswerMessage({
    modelAnswer: body.spanishText,
    altAnswer: body.altAnswer,
    prevText: body.prevText,
    playText: body.playText,
    nextText: body.nextText,
    sectionName: body.sectionName,
  });

  // Small focused call; escalate reasoning if the first attempt comes back empty.
  for (const effort of ['minimal', 'low'] as const) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-5.5',
        max_completion_tokens: 1200,
        reasoning_effort: effort,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CORRECT_ANSWER_SYSTEM },
          { role: 'user', content: userContent },
        ],
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) { console.warn(`[correct-answer] empty (effort=${effort})`); continue; }
      try {
        const parsed = JSON.parse(content) as { answer?: unknown };
        const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
        if (answer) return Response.json({ answer });
      } catch {
        console.warn(`[correct-answer] parse fail (effort=${effort})`);
      }
    } catch (e) {
      console.error(`[correct-answer] error (effort=${effort}):`, e);
    }
  }
  return Response.json({ answer: '' });
}
