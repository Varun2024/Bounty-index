import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { ingestAll } from '@/lib/ingest/bounty-targets';
import { deliverDiscordAlerts } from '@/lib/ingest/deliver-discord';
import { PROGRAMS_CACHE_TAG } from '@/lib/db/queries';

export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
  return NextResponse.json({ ok: true, results, discord });
}
