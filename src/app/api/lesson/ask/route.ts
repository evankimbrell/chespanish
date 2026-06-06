import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { NARRATOR_VOICE_ID, SPANISH_MALE_VOICE_ID } from '@/lib/voices';

const ENGLISH_VOICE = NARRATOR_VOICE_ID;
const SPANISH_VOICE = SPANISH_MALE_VOICE_ID;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const SYSTEM = `You are an Argentine Spanish tutor answering a student's question mid-lesson.

Format your answer using ONLY these tags:
<English voice>English narration here</English voice>
<Spanish voice>Spanish phrases here</Spanish voice>

Rules:
- Give a thorough, satisfying explanation: 80–180 words total
- Include multiple Spanish examples where helpful — show the phrase in context, not just isolated
- Use <Spanish voice> ONLY for actual Spanish words/phrases, never for English
- Use vos conjugations (tenés, querés, estás, sos) not tú conjugations
- Be warm and encouraging
- Do not say "Great question" or similar filler
- End with a brief note that the lesson will resume

Example:
<English voice>
The word "cortado" means a coffee with a splash of milk — it's one of the most common orders at any café in Buenos Aires. The name comes from "cortar" (to cut), because the espresso is "cut" with just a splash of milk to soften the bitterness. To order one you say:
</English voice>
<Spanish voice>
Un cortado, por favor.
</Spanish voice>
<English voice>
If you want two, just say:
</English voice>
<Spanish voice>
Dos cortados, por favor.
</Spanish voice>
<English voice>
The lesson will resume now.
</English voice>`;

async function segmentToBuffer(text: string, voiceId: string): Promise<Buffer> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', output_format: 'mp3_44100_128' }),
    }
  );
  if (!res.ok) throw new Error(`ElevenLabs TTS error ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(req: Request) {
  const { question, lessonContext } = await req.json();
  if (!question) return Response.json({ error: 'missing question' }, { status: 400 });

  try {
    // Generate answer with voice tags
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.5',
      // gpt-5.5 spends reasoning tokens from this budget before emitting the answer;
      // 600 risked truncating to empty. 1500 leaves room for an 80–180 word reply.
      max_completion_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Lesson context: "${lessonContext ?? ''}"\n\nStudent question: "${question}"`,
        },
      ],
    });

    const answerText = completion.choices[0].message.content ?? '';

    // Parse voice segments
    const parts = answerText.split(/(<\/?English voice>|<\/?Spanish voice>)/gi);
    let current: 'english' | 'spanish' | null = null;
    const segments: { type: 'english' | 'spanish'; text: string }[] = [];
    for (const part of parts) {
      const clean = part.trim();
      if (/^<English voice>$/i.test(clean)) { current = 'english'; }
      else if (/^<Spanish voice>$/i.test(clean)) { current = 'spanish'; }
      else if (/^<\/.+>$/i.test(clean)) { current = null; }
      else if (current && clean) { segments.push({ type: current, text: clean }); }
    }

    if (segments.length === 0) {
      // Fallback: treat entire answer as English
      segments.push({ type: 'english', text: answerText });
    }

    // TTS all segments in parallel — order preserved by Promise.all
    const buffers = await Promise.all(
      segments.map((seg) => segmentToBuffer(seg.text, seg.type === 'english' ? ENGLISH_VOICE : SPANISH_VOICE))
    );

    const combined = Buffer.concat(buffers);

    const outDir = path.join(process.cwd(), 'public', 'lessons');
    fs.mkdirSync(outDir, { recursive: true });
    const filename = `ask-${Date.now()}.mp3`;
    fs.writeFileSync(path.join(outDir, filename), combined);

    return Response.json({ audioUrl: `/lessons/${filename}`, answerText });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
