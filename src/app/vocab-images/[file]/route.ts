import { MEDIA_VOCAB_IMAGES_DIR } from '@/lib/data-paths';
import { serveMedia } from '@/lib/media-files';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  return serveMedia(MEDIA_VOCAB_IMAGES_DIR, file, req);
}
