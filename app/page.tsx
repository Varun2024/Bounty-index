import { stats, topPayouts, recentlyAdded, trendingNewPayouts } from '@/lib/db/queries';
import { Ticker } from '@/app/_ui/ticker';
import { Hero } from './_home/hero';
import { Pulse } from './_home/pulse';
import { Comparison } from './_home/comparison';
import { Features } from './_home/features';
import { Receipts } from './_home/receipts';
import { FinalCTA } from './_home/final-cta';
import { SectionOrnament } from './_home/shared';

export const dynamic = 'force-dynamic';

// Order is value-first: pitch → prove with live data → feature detail → why-not-them → trust → how → convert.
export default async function Home() {
  const [s, top, recent, trending] = await Promise.all([
    stats().catch(() => null),
    topPayouts(5).catch(() => []),
    recentlyAdded(8, 14).catch(() => []),
    trendingNewPayouts(6, 30).catch(() => []),
  ]);

  return (
    <>
      <Hero s={s} top={top} />
      <Ticker />
      <Pulse recent={recent} trending={trending} />
      <SectionOrnament />
      <Features s={s} />
      <SectionOrnament />
      <Comparison />
      <Receipts s={s} />
      <FinalCTA s={s} />
    </>
  );
}
