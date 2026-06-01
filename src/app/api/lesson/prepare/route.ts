import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const LESSON_PROMPT = `You're a master Spanish tutor designing the first lesson for a student learning Argentine Spanish.

Create an audio lesson. The target length of the audio lesson is 2000 words.

The lesson should have an English language narrator that briefly explains at the beginning what we'll be doing in the lesson. The English language narrator is also used in the lesson when the user is instructed to do something, and for the outro encouraging the student.

IMPORTANT: The audio lesson should use the core tenets of Pimsleur lessons. Pimsleur is built around active recall under light pressure. Instead of passively listening or repeating, the learner is prompted to produce the answer before hearing it. The lesson pauses, the learner responds out loud, then the native speaker gives the correct version. This trains retrieval, pronunciation, and speaking automaticity rather than recognition alone. Use graduated interval recall: words and phrases return at carefully spaced intervals. Use a small set of high-value vocabulary and phrase patterns, then recombine them in different ways.

Each portion of the lesson needs to be labeled as <English voice> and <Spanish voice>. When the user is expected to respond with an answer, put <prompt>. Use <prompt> frequently to maintain engagement.

Wrap related groups of content in <section name="3-5 word label"> and </section> tags. Each lesson must have 5–7 sections total. All <English voice>, <Spanish voice>, and <prompt> tags must appear inside a section block.

Generate the lesson. Do not include any other text other than the lesson transcript. The English voice should never read Spanish.`;

const REPORTS_DIR = path.join(process.cwd(), 'data', 'reports');

function getUserReport(userName: string): { lessonTranscript?: string; title?: string } | null {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const safeName = userName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  const files = fs.readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.json') && f.startsWith(safeName + '-'))
    .sort()
    .reverse(); // most recent first

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
      if (raw.lessonTranscript) {
        const title = raw.testReport?.recommended_first_lesson?.title ?? null;
        return { lessonTranscript: raw.lessonTranscript, title };
      }
    } catch { /* skip */ }
  }
  return null;
}

export async function GET(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user') ?? 'student';

  // 1 — Check if we already have a personalized lesson transcript in their report
  const existing = getUserReport(user);
  if (existing?.lessonTranscript) {
    return Response.json({
      transcript: existing.lessonTranscript,
      title: existing.title ?? 'Your personalized lesson',
      source: 'personalized',
    });
  }

  // 2 — No report found — generate a random beginner lesson
  const context = `This is a brand new student with no level test data yet. Generate a beginner-friendly first lesson in Argentine Spanish (Rioplatense dialect). Focus on essential greetings, basic conversational phrases, and the most important patterns for everyday life in Buenos Aires. Use the vos conjugation throughout. Keep it friendly and engaging for a complete beginner.`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    max_completion_tokens: 8000,
    messages: [
      { role: 'user', content: `${LESSON_PROMPT}\n\n--- STUDENT CONTEXT ---\n${context}` },
    ],
  });

  const transcript = completion.choices[0]?.message?.content ?? '';

  // Extract first section name for the title
  const sectionMatch = transcript.match(/<section\s+name="([^"]+)"/i);
  const title = sectionMatch ? sectionMatch[1] : 'Introduction to Argentine Spanish';

  return Response.json({ transcript, title, source: 'random' });
}
