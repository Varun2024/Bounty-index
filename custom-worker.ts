// Custom Worker entry (wrangler `main`) wrapping the OpenNext-generated handler so we can add a
// scheduled() handler for the daily ingest cron. Excluded from the Next app's tsconfig — wrangler
// (esbuild) bundles it; it is not part of the app's type environment.
// Pattern: https://opennext.js.org/cloudflare/howtos/custom-worker

// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  // Fires on the cron trigger (0 6 * * *). Self-invokes the existing Next ingest route via the
  // WORKER_SELF_REFERENCE service binding, carrying the cron bearer the route checks. Keeping the
  // logic in the route means one ingest code path for both the cron and any manual trigger.
  async scheduled(_event: unknown, env: Record<string, any>, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const run = async () => {
      const req = new Request("https://self/api/cron/ingest", {
        headers: { authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
      });
      const res = await env.WORKER_SELF_REFERENCE.fetch(req);
      if (!res.ok) {
        console.error(`[cron] ingest returned ${res.status}`);
      }
    };
    ctx.waitUntil(run());
  },
};

// main is now this file, so the DO class the cache queue binds to must be re-exported here or the
// NEXT_CACHE_DO_QUEUE binding breaks at runtime.
// @ts-ignore `.open-next/worker.js` is generated at build time
export { DOQueueHandler } from "./.open-next/worker.js";
