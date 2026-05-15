import fs from 'fs';
import path from 'path';

export async function GET() {
  const dir = path.join(process.cwd(), 'data/reports');
  if (!fs.existsSync(dir)) return Response.json({ reports: [] });

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
  const reports = files.map((filename) => {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
      return {
        filename,
        userName: raw.userName ?? '—',
        generatedAt: raw.generatedAt ?? '',
        title: raw.testReport?.recommended_first_lesson?.title ?? 'Lesson',
        hasTranscript: !!raw.lessonTranscript,
        transcript: raw.lessonTranscript ?? null,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  return Response.json({ reports });
}
