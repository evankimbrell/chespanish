import fs from 'fs';
import path from 'path';

// Serve one generated media file from a DATA_DIR media directory. Shared by the
// /lessons/[file], /vocab-images/[file], and /test-audio/[file] route handlers so
// the URL shapes that clients persisted (localStorage audioUrls) keep resolving
// after the move out of public/.

// Generated filenames are ^[user]-[timestamp]-[idx](-suffix)?.ext — nothing else
// may pass. Rejects path separators, dotfiles, and traversal by construction.
const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export function isSafeMediaName(name: string): boolean {
  return SAFE_NAME_RE.test(name) && !name.includes('..') && path.extname(name).toLowerCase() in CONTENT_TYPES;
}

export function contentTypeFor(name: string): string {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream';
}

// Parse a single-range header ("bytes=start-end", "bytes=start-", "bytes=-suffix")
// against a known size. Returns null for absent/malformed/multi-range (→ serve 200),
// and 'unsatisfiable' when the range is out of bounds (→ 416).
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'unsatisfiable' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    // suffix range: last N bytes
    const suffix = Number(m[2]);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

// iOS Safari requires 206 partial responses for <audio> to seek/play reliably —
// this app is audio-first, so Range support is not optional.
export async function serveMedia(dir: string, filename: string, req: Request): Promise<Response> {
  if (!isSafeMediaName(filename)) return new Response('Not found', { status: 404 });
  const filePath = path.join(dir, filename);
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!stat.isFile()) return new Response('Not found', { status: 404 });

  const baseHeaders: Record<string, string> = {
    'Content-Type': contentTypeFor(filename),
    // Names embed a ms timestamp + index → immutable once written. private: the
    // gate cookie protects media, so shared caches must not store it.
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  };

  const range = parseRange(req.headers.get('range'), stat.size);
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
  }

  // Files are a few MB at most — buffer + slice beats stream plumbing here.
  const buf = await fs.promises.readFile(filePath);
  if (range) {
    const body = buf.subarray(range.start, range.end + 1);
    return new Response(new Uint8Array(body), {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
        'Content-Length': String(body.length),
      },
    });
  }
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: { ...baseHeaders, 'Content-Length': String(stat.size) },
  });
}
