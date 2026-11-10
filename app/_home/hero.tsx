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
  const lastIngest = s?.lastIngestAt ? relativeTime(s.lastIngestAt) : null;
  const programCount = s?.programs.toLocaleString() ?? null;
  const payingCount = s?.bountyPrograms.toLocaleString() ?? null;
  const assetCount = s?.inScopeAssets.toLocaleString() ?? null;
  const platformCount = s?.platforms ?? 6;

  return (
    <div className="relative overflow-hidden lg:min-h-[85vh]">
      <HeroDataBackdrop identifiers={bgIdentifiers} />

      <div className="relative max-w-[1280px] mx-auto px-6 flex flex-col min-h-full">
        <div className="flex-1 grid lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-16 items-start pt-16 pb-14 lg:pt-20 lg:pb-16">
          <section className="animate-[fadeUp_.7s_ease-out_both]">
            {/* Bright/dim split: "every" (completeness) and "one index" (unification) carry the
                pitch, so they stay neutral-50; the descriptive middle drops to neutral-500 so the
                load-bearing words land first. neutral-500 on the bg clears WCAG AA for large text. */}
            <h1 className="lowercase text-[2.75rem] sm:text-5xl md:text-6xl xl:text-[4.5rem] font-medium tracking-[-0.035em] leading-[0.98] text-neutral-50">
              every <span className="text-neutral-400">public bounty program,</span> one index.
            </h1>

            {/* One tight pitch: the two load-bearing numbers emphasized, then what you do with them.
                The biggest-stated-max used to be crammed on here too — it already leads the leaderboard
                aside, so repeating it just diluted the line. */}
            <p className="mt-8 text-lg md:text-xl text-neutral-300 leading-snug max-w-xl">
              {programCount ? (
                <>
                  <span className="mono text-neutral-100 tabular-nums">{programCount}</span> programs across{' '}
                  <span className="mono text-neutral-100 tabular-nums">{platformCount}</span> platforms, in one index.
                  {' '}Filter by scope, asset, or payout.
                </>
              ) : (
                'Public programs from HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, Immunefi, and HackenProof.'
              )}
            </p>

            {/* The live thing: an inline scope check (the product's signature feature),
                not just a keyword search that navigates away. See hero-scope-check.tsx. */}
            <HeroScopeCheck programCount={programCount} />

            {/* Proof cluster: the scattered trust sentence + MCP chip, regrouped under one hairline
                into a scannable signal row so the lower hero reads as proof, not filler prose. The
                load-bearing values (weekly hunters, refresh age) are lifted out of the muted label
                text; the MCP chip stays the standout — the live surface we're pushing. */}
            <div className="mt-12 pt-6 border-t border-neutral-900 max-w-xl">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-400">
                <span>
                  <span className="mono tabular-nums text-neutral-100">2,000+</span> hunters / week
                </span>
                <span aria-hidden className="text-neutral-700">·</span>
                <span>free, no signup</span>
                {lastIngest && (
                  <>
                    <span aria-hidden className="text-neutral-700">·</span>
                    <span>
                      refreshed <span className="text-neutral-200">{lastIngest}</span>
                    </span>
                  </>
                )}
              </div>

              <Link
                href="/mcp"
                className="group mt-4 inline-flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 py-2 pl-3 pr-3.5 text-sm transition hover:border-emerald-800/70 hover:bg-neutral-900/70 focus-ring"
              >
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span className="text-neutral-300 transition group-hover:text-neutral-100">
                  MCP endpoint for agents
                </span>
                {mcpRequests > 0 && (
                  <>
                    <span aria-hidden className="text-neutral-700">·</span>
                    <span className="mono tabular-nums text-emerald-300">{mcpRequests.toLocaleString()}</span>
                    <span className="text-neutral-400">
                      request{mcpRequests === 1 ? '' : 's'} served
                    </span>
                  </>
                )}
              </Link>
            </div>
          </section>

          {top.length > 0 && (
            <aside
              aria-label="Programs with the highest stated maximum bounty"
              className="lg:mt-6 lg:sticky lg:top-24"
            >
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-sm text-neutral-400" title="Ranked by the maximum bounty each program states. A ceiling, not a typical payout.">biggest stated max, right now</p>
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

