import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { PROGRAMS_CACHE_TAG } from '@/lib/db/queries';

// Cache-bust endpoint. The daily ingest runs off-Worker (GitHub Action — the full scrape blows the
// Cloudflare subrequest cap), so it writes to Neon directly and then calls this to make the live
// site show fresh data within one page load. revalidateTag writes the D1 tag cache (a binding, not
// a subrequest), so this is cheap and safe on the Worker. Auth mirrors the old cron: CRON_SECRET
// bearer, fail CLOSED when unset.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('authorization') ?? '';
  const want = secret ? `Bearer ${secret}` : '';
  const authorized =
    !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!authorized) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  revalidateTag(PROGRAMS_CACHE_TAG, 'default');
  return NextResponse.json({ ok: true, revalidated: PROGRAMS_CACHE_TAG });
}
