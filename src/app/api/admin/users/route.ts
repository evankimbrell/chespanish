import fs from 'fs';
import path from 'path';

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

export async function GET() {
  const reportsDir = path.join(process.cwd(), 'data/reports');
  const lessonsDir = path.join(process.cwd(), 'data/lessons');

  // Collect all known usernames from report files
  const userMap: Record<string, {
    name: string;
    level: string | null;
    lastReportAt: string | null;
    hasLevelTest: boolean;
  }> = {};

  if (fs.existsSync(reportsDir)) {
    for (const file of fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'))) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf8'));
        const name = raw.userName as string;
        if (!name) continue;
        const key = safeName(name);
        const generatedAt = raw.generatedAt ?? '';
        if (!userMap[key] || generatedAt > (userMap[key].lastReportAt ?? '')) {
          userMap[key] = {
            name,
            level: raw.testReport?.display_level ?? null,
            lastReportAt: generatedAt,
            hasLevelTest: !!raw.session?.completedAt,
          };
        }
      } catch { /* skip malformed */ }
    }
  }

  // Also pick up users who have lesson history but no report
  if (fs.existsSync(lessonsDir)) {
    for (const file of fs.readdirSync(lessonsDir).filter(f => f.endsWith('.json'))) {
      const key = file.replace('.json', '');
      if (!userMap[key]) {
        userMap[key] = { name: key, level: null, lastReportAt: null, hasLevelTest: false };
      }
    }
  }

  // Enrich each user with lesson stats
  const users = await Promise.all(
    Object.values(userMap).map(async (u) => {
      const key = safeName(u.name);
      const lessonFile = path.join(lessonsDir, `${key}.json`);
      let lessonsStarted = 0;
      let lessonsCompleted = 0;
      let lastLessonAt: string | null = null;

      if (fs.existsSync(lessonFile)) {
        try {
          const entries: { completed?: boolean; lastAccessedAt?: string }[] =
            JSON.parse(fs.readFileSync(lessonFile, 'utf8'));
          lessonsStarted = entries.length;
          lessonsCompleted = entries.filter(e => e.completed).length;
          lastLessonAt = entries.reduce<string | null>((best, e) => {
            if (!e.lastAccessedAt) return best;
            return !best || e.lastAccessedAt > best ? e.lastAccessedAt : best;
          }, null);
        } catch { /* skip */ }
      }

      const lastActiveAt = [u.lastReportAt, lastLessonAt].filter(Boolean).sort().at(-1) ?? null;

      return {
        name: u.name,
        level: u.level,
        hasLevelTest: u.hasLevelTest,
        lessonsStarted,
        lessonsCompleted,
        lastActiveAt,
      };
    })
  );

  users.sort((a, b) => (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? ''));

  return Response.json({ users });
}
