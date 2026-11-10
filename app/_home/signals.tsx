import type { getRecentChanges, trendingNewPayouts, PayoutDistribution } from '@/lib/db/queries';
import { PulsePanel, ChangeRow, TrendingRow } from './pulse';
import { PayoutPanel, CoveragePanel } from './data-illustration';

interface SignalsProps {
  changes: Awaited<ReturnType<typeof getRecentChanges>>;
  trending: Awaited<ReturnType<typeof trendingNewPayouts>>;
  dist: PayoutDistribution | null;
  platforms: { platform: string; programs: number }[];
}

// One unified "what's happening + what it adds up to" section. Previously two back-to-back 2-panel
// sections (Pulse's live feeds, then the corpus charts) — the same content, but stacked, read as a
// wall of identical grids and cost a whole extra section envelope. Merged into a single 2x2 grid
// under one header: live feeds on top, the corpus charts beneath. No content removed.
export function Signals({ changes, trending, dist, platforms }: SignalsProps) {
  const hasPulse = changes.length > 0 || trending.length > 0;
  const hasPayouts = dist != null && dist.n >= 8; // same aggregate floor the program card uses
  const hasCoverage = platforms.length > 0;
  if (!hasPulse && !hasPayouts && !hasCoverage) return null;

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-16 md:py-20">
      <div className="mb-12 reveal max-w-3xl">
        <p className="text-sm text-neutral-400 mb-3">Live, and in the data</p>
        <h2 className="text-4xl md:text-5xl font-semibold text-neutral-50 tracking-tight leading-[1.02]">
          What&apos;s moving,<br />
          <span className="text-neutral-400">and what it adds up to.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
        {hasPulse && (
          <>
            <PulsePanel
              eyebrow="Scope moved"
              hint="last 7 days"
              empty="No scope or reward changes in the last 7 days."
              footer={changes.length > 0 ? { href: '/whats-new', label: 'all changes' } : undefined}
            >
              {changes.map((c) => (
                <ChangeRow key={`${c.program.id}-${c.capturedAt.getTime()}`} c={c} />
              ))}
            </PulsePanel>

            <PulsePanel
              eyebrow="Top new payouts"
              hint="last 30 days"
              empty="No paying programs added recently."
              footer={trending.length > 0 ? { href: '/programs?sort=reward', label: 'full leaderboard' } : undefined}
            >
              {trending.map((p) => (
                <TrendingRow key={p.id} p={p} />
              ))}
            </PulsePanel>
          </>
        )}

        {hasPayouts && <PayoutPanel dist={dist!} />}
        {hasCoverage && <CoveragePanel platforms={platforms} />}
      </div>
    </section>
  );
}
