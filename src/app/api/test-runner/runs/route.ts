import fs from 'fs';
import path from 'path';
import type { TestRun } from '@/lib/testing/types';

const RUNS_DIR = path.join(process.cwd(), 'data', 'test-runs');

function ensureDir() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

export async function GET() {
  ensureDir();
  const files = fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse(); // newest first

  const runs = files
    .map((f) => {
      try {
        const run = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8')) as TestRun;
        return {
          id: run.id,
          createdAt: run.createdAt,
          status: run.status,
          instructions: run.instructions,
          hypothesis: run.hypothesis,
          targetArea: run.targetArea,
          scenariosTotal: run.scenarios.length,
          scenariosPassed: run.scenarios.filter((s) => s.passed).length,
          bugsFound: run.bugs.length,
          verificationRun: run.verificationRun,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return Response.json({ runs });
}

export async function DELETE() {
  ensureDir();
  const files = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json'));
  for (const f of files) fs.unlinkSync(path.join(RUNS_DIR, f));

  // Also clean up test audio files
  const audioDir = path.join(process.cwd(), 'public', 'test-audio');
  if (fs.existsSync(audioDir)) {
    for (const f of fs.readdirSync(audioDir)) {
      try { fs.unlinkSync(path.join(audioDir, f)); } catch {}
    }
  }

  return Response.json({ cleared: files.length });
}
