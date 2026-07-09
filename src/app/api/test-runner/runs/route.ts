import fs from 'fs';
import path from 'path';
import type { TestRun, SimulationRun } from '@/lib/testing/types';
import * as dp from '@/lib/data-paths';

const RUNS_DIR = dp.TEST_RUNS_DIR;

function ensureDir() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

export async function GET() {
  ensureDir();
  const files = fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();

  const runs = files
    .map((f) => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8'));
        if (raw.mode === 'simulation') {
          const r = raw as SimulationRun;
          return {
            id: r.id,
            mode: 'simulation' as const,
            createdAt: r.createdAt,
            status: r.status,
            studentName: r.studentName,
            designatedLevel: r.designatedLevel,
            detectedLevel: r.detectedLevel,
            levelAccurate: r.levelAccurate,
            promptCount: r.prompts.length,
            verificationRun: null,
            instructions: '',
            hypothesis: '',
            targetArea: 'grading',
            scenariosTotal: 0,
            scenariosPassed: 0,
            bugsFound: 0,
          };
        }
        const r = raw as TestRun;
        return {
          id: r.id,
          mode: 'scenario' as const,
          createdAt: r.createdAt,
          status: r.status,
          instructions: r.instructions,
          hypothesis: r.hypothesis,
          targetArea: r.targetArea,
          scenariosTotal: r.scenarios.length,
          scenariosPassed: r.scenarios.filter((s) => s.passed).length,
          bugsFound: r.bugs.length,
          verificationRun: r.verificationRun,
          studentName: null,
          designatedLevel: null,
          detectedLevel: null,
          levelAccurate: null,
          promptCount: 0,
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
  const audioDir = dp.MEDIA_TEST_AUDIO_DIR;
  if (fs.existsSync(audioDir)) {
    for (const f of fs.readdirSync(audioDir)) {
      try { fs.unlinkSync(path.join(audioDir, f)); } catch {}
    }
  }

  return Response.json({ cleared: files.length });
}
