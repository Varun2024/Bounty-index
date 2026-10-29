import Link from 'next/link';
import { stats, topPayouts } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';
import { HeroDataBackdrop } from './hero-data-backdrop';
import { HeroScopeCheck } from './hero-scope-check';

interface HeroProps {
  s: Awaited<ReturnType<typeof stats>> | null;
  top: Awaited<ReturnType<typeof topPayouts>>;
  mcpRequests: number;
  bgIdentifiers: string[];
}

export function Hero({ s, top, mcpRequests, bgIdentifiers }: HeroProps) {
  const topBounty = s && top[0]?.maxBounty ? `$${top[0].maxBounty.toLocaleString()}` : null;
  const lastIngest = s?.lastIngestAt ? relativeTime(s.lastIngestAt) : null;
  const programCount = s?.programs.toLocaleString() ?? null;
  const payingCount = s?.bountyPrograms.toLocaleString() ?? null;
  const assetCount = s?.inScopeAssets.toLocaleString() ?? null;
  const platformCount = s?.platforms ?? 6;

  return (
    <div className="relative overflow-hidden lg:min-h-[calc(100vh-3.5rem)]">
      <HeroDataBackdrop identifiers={bgIdentifiers} />

      <div className="relative max-w-[1280px] mx-auto px-6 flex flex-col min-h-full">
        <div className="flex-1 grid lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-16 items-start pt-24 pb-20 lg:pt-28 lg:pb-24">
          <section className="animate-[fadeUp_.7s_ease-out_both]">
            {/* Bright/dim split: "every" (completeness) and "one index" (unification) carry the
                pitch, so they stay neutral-50; the descriptive middle drops to neutral-500 so the
                load-bearing words land first. neutral-500 on the bg clears WCAG AA for large text. */}
            <h1 className="lowercase text-[2.75rem] sm:text-5xl md:text-6xl xl:text-[4.5rem] font-medium tracking-[-0.035em] leading-[0.98] text-neutral-50">
              every <span className="text-neutral-500">public bounty program,</span> one index.
            </h1>

            <p className="mt-8 text-lg md:text-xl text-neutral-300 leading-snug max-w-xl">
              {programCount ? (
                <>
                  <span className="mono text-neutral-100 tabular-nums">{programCount}</span> programs across six platforms.
                  Filter by scope, asset, payout.
                  {topBounty && (
                    <> Highest live today: <span className="mono text-neutral-100 tabular-nums">{topBounty}</span>.</>
                  )}
                </>
              ) : (
                'Public programs from HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, Immunefi, and HackenProof.'
              )}
            </p>

            {/* The live thing: an inline scope check (the product's signature feature),
                not just a keyword search that navigates away. See hero-scope-check.tsx. */}
            <HeroScopeCheck programCount={programCount} />

            <p className="mt-12 text-sm text-neutral-400 max-w-xl">
              Used weekly by 2,000+ hunters. Free, no signup.
              {lastIngest && <> Index refreshed {lastIngest}.</>}{' '}
              <Link href="/mcp" className="text-neutral-300 hover:text-emerald-300 transition underline decoration-neutral-700 underline-offset-4 hover:decoration-emerald-400">
                MCP endpoint
              </Link>{' '}
              for agents.
              {mcpRequests > 0 && (
                <>
                  {' '}
                  <span className="mono text-neutral-100 tabular-nums">{mcpRequests.toLocaleString()}</span>{' '}
                  request{mcpRequests === 1 ? '' : 's'} served.
                </>
              )}
            </p>
          </section>

          {top.length > 0 && (
            <aside
              aria-label="Highest-paying programs right now"
              className="lg:mt-6 lg:sticky lg:top-24"
            >
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-sm text-neutral-400">paying the most, right now</p>
                <Link
                  href="/programs?sort=reward"
                  className="mono text-xs text-neutral-400 hover:text-emerald-300 transition focus-ring rounded"
                >
                  leaderboard
                </Link>
              </div>
              <ol className="divide-y divide-neutral-900">
                {top.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/programs/${p.platform}/${p.slug}`}
                      className="flex items-center gap-3 py-3 group focus-ring rounded-md -mx-2 px-2 hover:bg-neutral-900/40 transition"
                    >
                      <span
                        aria-hidden
                        className={`shrink-0 w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-100 truncate group-hover:text-emerald-300 transition">
                          {p.name}
                        </p>
                        <p className="mono text-[11px] text-neutral-400 mt-0.5">{platformLabel(p.platform)}</p>
                      </div>
                      <p className="mono text-sm text-neutral-100 shrink-0 tabular-nums">
                        up to {formatBounty(p.maxBounty, p.currency ?? 'USD')}
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>

        {s && (
          <dl className="pb-16 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-8">
            <StatInline label="programs" value={programCount!} />
            <StatInline label="paying bounties" value={payingCount!} accent />
            <StatInline label="in-scope assets" value={assetCount!} />
            <StatInline label="platforms" value={String(platformCount)} />
          </dl>
        )}
      </div>
    </div>
  );
}

function StatInline({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dd className={`mono tabular-nums text-2xl md:text-3xl font-medium ${accent ? 'text-emerald-300' : 'text-neutral-50'}`}>
        {value}
      </dd>
      <dt className="mt-1 text-xs text-neutral-400">{label}</dt>
    </div>
  );
}

