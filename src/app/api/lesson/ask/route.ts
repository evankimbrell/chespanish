import OpenAI from 'openai';
import { ElevenLabsClient } from 'elevenlabs';
import fs from 'fs';
import path from 'path';

const ENGLISH_VOICE = 'nzFihrBIvB34imQBuxub';
const SPANISH_VOICE = 'qnvusyIjzlSoWYJ0C2Nm';

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
- Keep answers concise: 30–80 words total
- Use <Spanish voice> ONLY for actual Spanish words/phrases, never for English
- Use vos conjugations (tenés, querés, estás, sos) not tú conjugations
- Be warm and encouraging
- Do not say "Great question" or similar filler

Example:
<English voice>
The word "cortado" means a coffee with a splash of milk. To order one you say:
</English voice>
<Spanish voice>
Un cortado, por favor.
</Spanish voice>
<English voice>
The lesson will resume automatically after this.
</English voice>`;

async function segmentToBuffer(text: string, voiceId: string): Promise<Buffer> {
  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
  const stream = await client.textToSpeech.convertAsStream(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
  });
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as ArrayBuffer));
  }
  return Buffer.concat(chunks);
}

export async function POST(req: Request) {
  const { question, lessonContext } = await req.json();
  if (!question) return Response.json({ error: 'missing question' }, { status: 400 });

  try {
    // Generate answer with voice tags
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
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

    // TTS each segment sequentially (keep order)
    const buffers: Buffer[] = [];
    for (const seg of segments) {
      const voiceId = seg.type === 'english' ? ENGLISH_VOICE : SPANISH_VOICE;
      buffers.push(await segmentToBuffer(seg.text, voiceId));
    }

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
