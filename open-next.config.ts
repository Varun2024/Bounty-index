import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// Phase 1 caching:
// - R2 holds the ISR/incremental cache (page + fetch cache).
// - DO queue drives time-based revalidation (pages with `revalidate`).
// - D1 tag cache makes `revalidateTag(PROGRAMS_CACHE_TAG)` work (daily ingest freshness).
//   D1 (not DO-sharded) is correct here: ingest busts ONE shared tag, so the tag set is tiny.
// See docs/plans/PLAN_CLOUDFLARE_MIGRATION.md.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
});
