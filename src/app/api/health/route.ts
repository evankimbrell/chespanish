import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '@/lib/data-paths';

// GET /api/health — gate-exempt (Fly's health checks carry no cookies). Proves the
// data volume is writable and reports the deployed commit, so a remote agent can
// verify a deploy landed without shell access.
export const dynamic = 'force-dynamic';

const startedAt = Date.now();

export async function GET() {
  let diskWritable = false;
  let diskFreeMB: number | null = null;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const probe = path.join(DATA_DIR, `.health-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    diskWritable = true;
  } catch {
    // reported below via ok:false / 503
  }
  try {
    const sf = await fs.promises.statfs(DATA_DIR);
    diskFreeMB = Math.round((sf.bavail * sf.bsize) / 1024 / 1024);
  } catch {
    // statfs unsupported → leave null; writability is the real signal
  }

  const body = {
    ok: diskWritable,
    sha: process.env.GIT_SHA ?? 'dev',
    dataDir: DATA_DIR,
    diskWritable,
    diskFreeMB,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  };
  return Response.json(body, { status: diskWritable ? 200 : 503 });
}
