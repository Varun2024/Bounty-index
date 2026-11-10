import { stats, topPayouts, getRecentChanges, trendingNewPayouts, mcpTotalRequests, sampleScopeIdentifiers, disclosedPayoutDistribution, listPlatformsWithCounts } from '@/lib/db/queries';
import { Ticker } from '@/app/_ui/ticker';
import { Hero } from './_home/hero';
import { Signals } from './_home/signals';
import { Comparison } from './_home/comparison';
import { Features } from './_home/features';
import { Receipts } from './_home/receipts';
import { FinalCTA } from './_home/final-cta';
import { SectionOrnament } from './_home/shared';
import { datasetLd, jsonLdScript } from '@/lib/structured-data';

// ISR: home data (stats, top payouts, recently added, trending) refreshes once an hour,
// the ingest cron revalidates the PROGRAMS_CACHE_TAG when it runs, and the only user-specific
// surface in the shared layout (UserMenu) is now client-hydrated — so the shell caches cleanly.
export const revalidate = 3600;

// Order is value-first: pitch → prove with live data → feature detail → why-not-them → trust → how → convert.
export default async function Home() {
  const [s, top, changes, trending, mcpRequests, bgIdentifiers, payoutDist, platformCounts] = await Promise.all([
    stats().catch(() => null),
    topPayouts(5).catch(() => []),
    getRecentChanges(168, 6).catch(() => []),
    trendingNewPayouts(6, 30).catch(() => []),
    mcpTotalRequests().catch(() => 0),
    sampleScopeIdentifiers(16).catch(() => []),
    disclosedPayoutDistribution().catch(() => null),
    listPlatformsWithCounts().catch(() => [] as { platform: string; programs: number }[]),
  ]);

  return (
    <>
      {/* Dataset JSON-LD: the index is a dataset, so declare it as one (with downloadable
          CSV/JSON distributions) for Google Dataset Search and AI answer engines. Numbers
          come from live stats — skipped entirely if stats are unavailable. */}
      {s && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(datasetLd(s)) }} />
      )}
      <Hero s={s} top={top} mcpRequests={mcpRequests} bgIdentifiers={bgIdentifiers} />
      <Ticker />
      <Signals changes={changes} trending={trending} dist={payoutDist} platforms={platformCounts} />
      <SectionOrnament />
      <Features s={s} />
      <SectionOrnament />
      <Comparison />
      <Receipts s={s} />
      <FinalCTA s={s} />
    </>
  );
}
