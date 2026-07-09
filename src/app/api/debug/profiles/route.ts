import fs from 'fs';
import path from 'path';
import * as dp from '@/lib/data-paths';

export async function GET() {
  const dir = dp.REPORTS_DIR;
  if (!fs.existsSync(dir)) return Response.json({ profiles: [] });

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  // Read each file, skip debug-* usernames, keep latest per user
  const byUser = new Map<string, { name: string; level: string; generatedAt: string }>();

  for (const filename of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
      const userName: string = raw.userName ?? '';
      if (!userName || userName.toLowerCase().startsWith('debug')) continue;

      const level: string = raw.testReport?.display_level ?? raw.testReport?.cefr_band ?? null;
      const generatedAt: string = raw.generatedAt ?? '';

      const existing = byUser.get(userName.toLowerCase());
      if (!existing || generatedAt > existing.generatedAt) {
        byUser.set(userName.toLowerCase(), { name: userName, level: level ?? '—', generatedAt });
      }
    } catch { /* skip malformed */ }
  }

  // Sort by name
  const profiles = Array.from(byUser.values())
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({ profiles });
}
