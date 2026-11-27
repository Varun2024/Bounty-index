// Daily ingest, run off-Worker (GitHub Action). The full scrape does thousands of per-query Neon
// HTTP calls — one Cloudflare subrequest each — which blows the Worker 50/invocation cap, so it
// can't live in the CF cron. Node has no such cap. Same code path as the old route: ingestAll()
// writes to Neon, deliverDiscordAlerts() posts subscriber webhooks, then we call the Worker's
// /api/revalidate to bust the live cache (revalidateTag only works inside the deployed runtime).
//
// Run: tsx scripts/ingest.ts   (tsx resolves the @/* tsconfig paths used by the imported modules)
// Env: DATABASE_URL, NEXT_PUBLIC_SITE_URL, CRON_SECRET, REVALIDATE_URL
// dotenv auto-loads .env for local runs; in CI there's no .env and env comes from Actions secrets,
// so this is a harmless no-op there.
import 'dotenv/config';
import { ingestAll } from '@/lib/ingest/bounty-targets';
import { deliverDiscordAlerts } from '@/lib/ingest/deliver-discord';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  const startedAt = new Date();
  const results = await ingestAll();
  const discord = await deliverDiscordAlerts(startedAt).catch((err: unknown) => ({
    error: err instanceof Error ? err.message : String(err),
  }));

  // Bust the live site cache via the deployed Worker.
  const base = process.env.REVALIDATE_URL;
  const secret = process.env.CRON_SECRET;
  let revalidated = false;
  if (base && secret) {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    });
    revalidated = res.ok;
    if (!res.ok) console.error(`[ingest] revalidate failed: HTTP ${res.status}`);
  } else {
    console.error('[ingest] REVALIDATE_URL or CRON_SECRET unset — skipping cache bust');
  }

  const failures = results.filter((r) => typeof r.error === 'string');
  console.log(JSON.stringify({ failures: failures.length, revalidated, results, discord }, null, 2));

  // Fail the CI run only on a total outage (every source errored) so a flaky single source
  // doesn't red the whole job but a real breakage is visible.
  if (results.length > 0 && failures.length === results.length) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
