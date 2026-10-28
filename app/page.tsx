import { stats, topPayouts, getRecentChanges, trendingNewPayouts, mcpAgentsThisWeek, sampleScopeIdentifiers } from '@/lib/db/queries';
import { Ticker } from '@/app/_ui/ticker';
import { Hero } from './_home/hero';
import { Pulse } from './_home/pulse';
import { Comparison } from './_home/comparison';
import { Features } from './_home/features';
import { Receipts } from './_home/receipts';
import { FinalCTA } from './_home/final-cta';
import { SectionOrnament } from './_home/shared';

// ISR: home data (stats, top payouts, recently added, trending) refreshes once an hour,
// the ingest cron revalidates the PROGRAMS_CACHE_TAG when it runs, and the only user-specific
// surface in the shared layout (UserMenu) is now client-hydrated — so the shell caches cleanly.
export const revalidate = 3600;

// Order is value-first: pitch → prove with live data → feature detail → why-not-them → trust → how → convert.
export default async function Home() {
  const [s, top, changes, trending, agentsThisWeek, bgIdentifiers] = await Promise.all([
    stats().catch(() => null),
    topPayouts(5).catch(() => []),
    getRecentChanges(168, 6).catch(() => []),
    trendingNewPayouts(6, 30).catch(() => []),
    mcpAgentsThisWeek().catch(() => 0),
    sampleScopeIdentifiers(48).catch(() => []),
  ]);

  return (
    <>
      <Hero s={s} top={top} agentsThisWeek={agentsThisWeek} bgIdentifiers={bgIdentifiers} />
      <Ticker />
      <Pulse changes={changes} trending={trending} />
      <SectionOrnament />
      <Features s={s} />
      <SectionOrnament />
      <Comparison />
      <Receipts s={s} />
      <FinalCTA s={s} />
    </>
  );
}
