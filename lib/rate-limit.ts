// Best-effort fixed-window rate limiter. In-memory and per serverless instance, so it does not
// coordinate across instances — but that is enough to blunt a single abusive client hammering a
// heavy public endpoint (the 5000-row export, the name search). A distributed limiter (Upstash
// etc.) is the upgrade if cross-instance limits ever matter.
// ponytail: global per-instance map; swap for a shared store if throughput demands it.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000; // guard against unbounded growth from spoofed/rotating IPs.

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // seconds until the window resets (0 when ok)
}

export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    if (buckets.size >= MAX_KEYS) {
      // Opportunistic sweep: drop every expired window. O(n) but only when the map is already huge.
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

// First hop of x-forwarded-for is the client as Vercel's edge sees it. Falls back to a constant so
// a missing header buckets everyone together (fail-safe toward limiting, not bypassing).
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  return xff ? xff.split(',')[0]!.trim() || 'unknown' : 'unknown';
}

// Standard 429 with Retry-After. Kept here so every caller returns an identical shape.
export function tooManyRequests(retryAfter: number): Response {
  return new Response('rate limited', {
    status: 429,
    headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' },
  });
}

// ponytail self-check: run `npx tsx lib/rate-limit.ts`
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const key = 'test';
  let res: RateLimitResult = { ok: true, retryAfter: 0 };
  for (let i = 0; i < 3; i++) res = rateLimit(key, 3, 60_000);
  console.assert(res.ok, 'first 3 within limit should pass');
  res = rateLimit(key, 3, 60_000);
  console.assert(!res.ok && res.retryAfter > 0, '4th should be limited with a retryAfter');
  const fresh = rateLimit('other', 3, 1); // 1ms window
  console.assert(fresh.ok, 'fresh key passes');
  console.log('rate-limit self-check passed');
}
