import fs from 'fs';
import path from 'path';
import type { TestRun } from '@/lib/testing/types';

const RUNS_DIR = path.join(process.cwd(), 'data', 'test-runs');

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const file = path.join(RUNS_DIR, `${runId}.json`);

  if (!fs.existsSync(file)) {
    return Response.json({ error: 'Run not found' }, { status: 404 });
  }

  try {
    const run = JSON.parse(fs.readFileSync(file, 'utf8')) as TestRun;
    return Response.json({ run });
  } catch {
    return Response.json({ error: 'Failed to read run' }, { status: 500 });
  }
}
