// Custom Worker entry (wrangler `main`) wrapping the OpenNext-generated handler. We keep a custom
// entry (rather than pointing `main` straight at the generated worker) solely so the DO queue class
// is re-exported from the same module wrangler bundles — see the re-export below.
//
// The daily ingest cron used to live here as a scheduled() handler, but the full scrape blows the
// Cloudflare per-invocation subrequest cap, so it moved to a GitHub Action that hits Neon directly
// and pings /api/revalidate. There is therefore no scheduled() handler and no cron trigger.
// See docs/plans/PLAN_CLOUDFLARE_MIGRATION.md.

// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
};

// main is this file, so the DO class the cache queue binds to must be re-exported here or the
// NEXT_CACHE_DO_QUEUE binding breaks at runtime.
// @ts-ignore `.open-next/worker.js` is generated at build time
export { DOQueueHandler } from "./.open-next/worker.js";
