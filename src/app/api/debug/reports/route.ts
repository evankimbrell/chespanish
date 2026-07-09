import fs from 'fs';
import path from 'path';
import * as dp from '@/lib/data-paths';

export async function GET() {
  const dir = dp.REPORTS_DIR;
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
