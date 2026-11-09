import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { ingestAll } from '@/lib/ingest/bounty-targets';
import { deliverDiscordAlerts } from '@/lib/ingest/deliver-discord';
import { PROGRAMS_CACHE_TAG } from '@/lib/db/queries';

export const maxDuration = 300;

export async function GET(req: Request) {
  // Fail CLOSED: an unset CRON_SECRET must lock the route, not open it. Vercel Cron sends this
  // Bearer header automatically when CRON_SECRET is configured, so this must stay set in Production.
  // Timing-safe compare; the length guard keeps timingSafeEqual from throwing on unequal lengths.
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('authorization') ?? '';
  const want = secret ? `Bearer ${secret}` : '';
  const authorized =
    !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!authorized) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const startedAt = new Date();
  const results = await ingestAll();
  // Deliver Discord webhook alerts for any snapshots written during this run.
  // Non-fatal — if delivery fails, ingest still counts as successful.
  const discord = await deliverDiscordAlerts(startedAt).catch((err) => ({
    error: err instanceof Error ? err.message : String(err),
  }));
  // Bust all cached public reads so visitors see fresh data within one page load.
  revalidateTag(PROGRAMS_CACHE_TAG, 'default');
  // Report real health so Vercel's cron dashboard flags a dead run. Each source returns either
  // its counters or an { error }. If EVERY source failed (network down, etc.) return 500 so the
  // run shows failed instead of a green ok:true hiding a total outage.
  const failures = results.filter((r) => typeof r.error === 'string').length;
  const allFailed = results.length > 0 && failures === results.length;
  return NextResponse.json({ ok: !allFailed, failures, results, discord }, { status: allFailed ? 500 : 200 });
}
