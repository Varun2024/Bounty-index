import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// Caching:
// - R2 incremental cache offloads ISR page/data writes (the Vercel cost driver we migrated to kill).
// - DO queue drives time-based revalidation (pages with `revalidate`).
// - D1 tag cache makes `revalidateTag(PROGRAMS_CACHE_TAG)` work (daily ingest freshness).
//   D1 (not DO-sharded) is correct here: ingest busts ONE shared tag, so the tag set is tiny.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
});
