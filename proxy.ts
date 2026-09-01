import { NextResponse, type NextRequest } from 'next/server';

// ponytail: in-memory per-instance rate limit. Fluid Compute reuses instances so warm hits
// accumulate correctly; cold-start abusers get a fresh window per instance. Upgrade to a
// shared store (Upstash / Vercel KV) only if we see actual abuse across regions.

const WINDOW_MS = 60_000;
const MAX_HITS = 60;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function proxy(req: NextRequest): NextResponse {
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  bucket.count++;
  if (bucket.count > MAX_HITS) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return new NextResponse(
      JSON.stringify({ error: 'rate_limited', retryAfterSeconds: retryAfter }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(retryAfter),
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/mcp/:path*', '/api/mcp'],
};
