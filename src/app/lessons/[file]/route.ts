import { MEDIA_LESSONS_DIR } from '@/lib/data-paths';
import { serveMedia } from '@/lib/media-files';

// Serves generated lesson audio from DATA_DIR (volume in prod). Preserves the
// /lessons/<file>.mp3 URL shape that clients persisted in localStorage before the
// move out of public/.
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  return serveMedia(MEDIA_LESSONS_DIR, file, req);
}
