import { generateLessonTranscript } from '@/lib/lesson-design';

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response('OPENAI_API_KEY not configured', { status: 500 });
  }

  const { lessonDesignBrief } = await req.json();
  if (!lessonDesignBrief) {
    return Response.json({ error: 'missing_lessonDesignBrief' }, { status: 400 });
  }

  try {
    const lessonTranscript = await generateLessonTranscript(lessonDesignBrief);
    return Response.json({ lessonTranscript });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
