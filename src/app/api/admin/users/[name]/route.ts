import fs from 'fs';
import path from 'path';

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const key = safeName(name);
  const reportsDir = path.join(process.cwd(), 'data/reports');
  const lessonsDir = path.join(process.cwd(), 'data/lessons');

  // Find latest report for this user
  let levelTest = null;
  if (fs.existsSync(reportsDir)) {
    const userReports = fs.readdirSync(reportsDir)
      .filter(f => f.endsWith('.json') && f.startsWith(key + '-'))
      .sort();

    if (userReports.length > 0) {
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(reportsDir, userReports.at(-1)!), 'utf8')
        );
        // Compute mistake analysis from session prompts
        const prompts: { grade?: { observed_errors?: { category: string; description: string }[] } }[] =
          raw.session?.prompts ?? [];
        const errorMap: Record<string, { count: number; examples: string[] }> = {};
        for (const p of prompts) {
          for (const err of p.grade?.observed_errors ?? []) {
            if (!errorMap[err.category]) errorMap[err.category] = { count: 0, examples: [] };
            errorMap[err.category].count++;
            if (errorMap[err.category].examples.length < 3) {
              errorMap[err.category].examples.push(err.description);
            }
          }
        }
        const byCategory = Object.entries(errorMap)
          .map(([category, { count, examples }]) => ({ category, count, examples }))
          .sort((a, b) => b.count - a.count);

        levelTest = {
          completedAt: raw.session?.completedAt ?? raw.generatedAt,
          report: raw.testReport ?? null,
          educatorReport: raw.educatorReport ?? null,
          prompts: raw.session?.prompts ?? [],
          mistakeAnalysis: { byCategory, total: byCategory.reduce((s, c) => s + c.count, 0) },
        };
      } catch { /* skip malformed */ }
    }
  }

  // Lesson history
  let lessonHistory: unknown[] = [];
  const lessonFile = path.join(lessonsDir, `${key}.json`);
  if (fs.existsSync(lessonFile)) {
    try {
      const entries = JSON.parse(fs.readFileSync(lessonFile, 'utf8'));
      lessonHistory = Array.isArray(entries)
        ? [...entries].sort((a: { lastAccessedAt?: string }, b: { lastAccessedAt?: string }) =>
            (b.lastAccessedAt ?? '').localeCompare(a.lastAccessedAt ?? ''))
        : [];
    } catch { /* skip */ }
  }

  return Response.json({
    name,
    level: levelTest?.report?.display_level ?? null,
    cefrBand: levelTest?.report?.cefr_band ?? null,
    levelTest,
    lessonHistory,
  });
}
