import { NextResponse } from 'next/server';
import { ingestAll } from '@/lib/ingest/bounty-targets';
import { deliverDiscordAlerts } from '@/lib/ingest/deliver-discord';

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
  return NextResponse.json({ ok: true, results, discord });
}
