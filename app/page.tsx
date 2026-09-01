import { stats, topPayouts, recentlyAdded, trendingNewPayouts } from '@/lib/db/queries';
import { Ticker } from '@/app/_ui/ticker';
import { Hero } from './_home/hero';
import { HowItWorks } from './_home/how-it-works';
import { Pulse } from './_home/pulse';
import { Comparison } from './_home/comparison';
import { Features } from './_home/features';
import { FinalCTA } from './_home/final-cta';
import { SectionOrnament } from './_home/shared';

export const dynamic = 'force-dynamic';

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
      <HowItWorks />
      <SectionOrnament />
      <Pulse recent={recent} trending={trending} />
      <SectionOrnament />
      <Comparison />
      <SectionOrnament />
      <Features s={s} />
      <FinalCTA s={s} />
    </>
  );
}
