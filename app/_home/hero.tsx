import Link from 'next/link';
import { stats, topPayouts } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';
import { BackdropGrid } from './shared';

interface HeroProps {
  s: Awaited<ReturnType<typeof stats>> | null;
  top: Awaited<ReturnType<typeof topPayouts>>;
}

export function Hero({ s, top }: HeroProps) {
  const topBounty = s && top[0]?.maxBounty ? `$${top[0].maxBounty.toLocaleString()}` : null;
  const lastIngest = s?.lastIngestAt ? relativeTime(s.lastIngestAt) : null;
  const programCount = s?.programs.toLocaleString() ?? null;
  const payingCount = s?.bountyPrograms.toLocaleString() ?? null;
  const assetCount = s?.inScopeAssets.toLocaleString() ?? null;
  const platformCount = s?.platforms ?? 6;

  return (
    <div className="relative overflow-hidden lg:min-h-[calc(100vh-3.5rem)]">
      <div className="parallax-slow absolute inset-0" aria-hidden><BackdropGrid /></div>

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
                'Public programs from HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, and Immunefi.'
              )}
            </p>

            {/* The live thing: a real search form. GETs to /programs?q=... */}
            <form
              method="GET"
              action="/programs"
              role="search"
              className="mt-12 max-w-xl"
              aria-label="Search bounty programs"
            >
              <label htmlFor="hero-q" className="sr-only">Search a company, domain, or asset</label>
              <div className="group flex items-center h-14 pl-5 pr-1.5 rounded-xl bg-neutral-950/70 border border-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] focus-within:border-emerald-400/60 focus-within:shadow-[0_0_0_4px_rgba(52,211,153,0.08),inset_0_1px_0_rgba(255,255,255,0.02)] transition duration-200">
                <span className="shrink-0 text-neutral-400 group-focus-within:text-emerald-300 transition" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </span>
                <input
                  id="hero-q"
                  type="search"
                  name="q"
                  autoComplete="off"
                  placeholder="search a company, domain, or asset"
                  className="flex-1 min-w-0 bg-transparent h-full px-4 text-base md:text-[17px] text-neutral-50 placeholder:text-neutral-500 outline-none"
                />
                <kbd className="hidden md:inline-flex items-center justify-center mono text-[10px] text-neutral-400 h-6 px-1.5 mr-2 rounded border border-neutral-800 bg-neutral-900/80 pointer-events-none">
                  /
                </kbd>
                <button
                  type="submit"
                  className="mono text-sm h-11 px-5 rounded-lg bg-emerald-400 text-neutral-950 font-medium hover:bg-emerald-300 active:bg-emerald-500 transition focus-ring"
                >
                  search
                </button>
              </div>
              <p className="mt-4 text-sm text-neutral-400 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="text-neutral-500">try</span>
                <ExampleQuery q="tesla" />
                <ExampleQuery q="ethereum" />
                <ExampleQuery q="*.google.com" />
                <span aria-hidden className="text-neutral-700">·</span>
                <Link href="/programs" className="text-neutral-300 hover:text-emerald-300 transition underline decoration-neutral-700 underline-offset-4 hover:decoration-emerald-400">
                  or browse all {programCount && <span className="mono tabular-nums">{programCount}</span>}
                </Link>
              </p>
            </form>

            <p className="mt-12 text-sm text-neutral-400 max-w-xl">
              Used weekly by 2,000+ hunters. Free, no signup.
              {lastIngest && <> Index refreshed {lastIngest}.</>}{' '}
              <Link href="/mcp" className="text-neutral-300 hover:text-emerald-300 transition underline decoration-neutral-700 underline-offset-4 hover:decoration-emerald-400">
                MCP endpoint
              </Link>{' '}
              for agents.
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

      <CornerMark position="top-left" />
      <CornerMark position="top-right" />
      <CornerMark position="bottom-left" />
      <CornerMark position="bottom-right" />
    </div>
  );
}

function ExampleQuery({ q }: { q: string }) {
  return (
    <Link
      href={`/programs?q=${encodeURIComponent(q)}`}
      className="mono text-xs px-2.5 py-1 rounded-md border border-neutral-800 text-neutral-300 hover:border-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-400/[0.04] transition focus-ring"
    >
      {q}
    </Link>
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

function CornerMark({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const map = {
    'top-left': 'top-4 left-4 border-l border-t',
    'top-right': 'top-4 right-4 border-r border-t',
    'bottom-left': 'bottom-4 left-4 border-l border-b',
    'bottom-right': 'bottom-4 right-4 border-r border-b',
  } as const;
  return (
    <span
      aria-hidden
      className={`hidden md:block absolute w-5 h-5 pointer-events-none border-neutral-800 ${map[position]}`}
    />
  );
}
