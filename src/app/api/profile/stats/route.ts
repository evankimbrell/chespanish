import fs from 'fs';
import path from 'path';
import * as dp from '@/lib/data-paths';

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user') ?? '';
  if (!user) return Response.json({ lessonsCompleted: 0, level: null });

  // lessonsCompleted — count entries in lesson history
  let lessonsCompleted = 0;
  try {
    const historyFile = path.join(process.cwd(), 'data/lessons', `${safeName(user)}.json`);
    if (fs.existsSync(historyFile)) {
      const entries = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      lessonsCompleted = Array.isArray(entries) ? entries.length : 0;
    }
  } catch { /* no history yet */ }

  // level — from most recent report with a testReport
  let level: string | null = null;
  try {
    const reportsDir = dp.REPORTS_DIR;
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir)
        .filter((f) => f.endsWith('.json') && f.startsWith(safeName(user) + '-'))
        .sort()
        .reverse();
      for (const file of files) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf8'));
          const lvl = raw.testReport?.display_level ?? raw.testReport?.cefr_band ?? null;
          if (lvl) { level = lvl; break; }
        } catch { /* skip */ }
      }
    }
  } catch { /* no reports */ }

  return Response.json({ lessonsCompleted, level });
}
