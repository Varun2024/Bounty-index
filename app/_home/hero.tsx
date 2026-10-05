import Link from 'next/link';
import { stats, topPayouts } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';
import { BackdropGrid, Stat } from './shared';

interface HeroProps {
  s: Awaited<ReturnType<typeof stats>> | null;
  top: Awaited<ReturnType<typeof topPayouts>>;
}

export function Hero({ s, top }: HeroProps) {
  const topBounty = s && top[0]?.maxBounty ? `$${top[0].maxBounty.toLocaleString()}` : null;
  const lastIngest = s?.lastIngestAt ? relativeTime(s.lastIngestAt) : null;

  return (
    <div className="relative overflow-hidden lg:min-h-[calc(100vh-3.5rem)]">
      <div className="parallax-slow absolute inset-0"><BackdropGrid /></div>

      <div className="relative max-w-[1280px] mx-auto px-6 flex flex-col min-h-full">
        <div className="flex-1 flex items-center py-20 lg:py-24">
        <div className="w-full grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-center justify-items-center lg:justify-items-stretch">
          <section className="relative text-center lg:text-left animate-[fadeUp_.7s_ease-out_both]">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-7 flex-wrap">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-sm text-emerald-300">2,000+ hunters use this weekly</span>
              {lastIngest && (
                <>
                  <span className="text-neutral-700">·</span>
                  <span className="text-sm text-neutral-400">
                    indexed <span className="text-neutral-200">{lastIngest}</span>
                  </span>
                </>
              )}
            </div>

            <h1 className="lowercase text-[2.75rem] sm:text-5xl md:text-6xl xl:text-[4.75rem] font-medium tracking-[-0.03em] leading-[1] text-neutral-50">
              every public bounty program.{' '}
              <span className="font-light text-emerald-300">one index.</span>
            </h1>

            <p className="mt-8 text-base md:text-lg text-neutral-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {s ? (
                <>
                  <span className="mono text-neutral-100 tabular-nums">{s.programs.toLocaleString()}</span> public programs
                  across six platforms — filtered by scope, asset type, and payout.
                  {topBounty && (
                    <>
                      {' '}Top of the leaderboard: <span className="mono text-emerald-300 tabular-nums">{topBounty}</span>.
                    </>
                  )}
                </>
              ) : (
                'Public programs from HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, and Immunefi — filtered by scope, asset type, and payout.'
              )}
            </p>

            <div className="mt-9 flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link
                href="/programs"
                className="cta-arrow mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition focus-ring"
              >
                browse programs <span className="arrow">→</span>
              </Link>
              <Link
                href="/scope-lookup"
                className="mono text-sm px-5 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md hover:border-neutral-600 hover:bg-neutral-900 transition"
              >
                check a domain
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-neutral-500">
              <li className="inline-flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-emerald-400/70" />
                <span>free, no signup</span>
              </li>
              <li className="inline-flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-emerald-400/70" />
                <span>daily data refresh</span>
              </li>
              <li className="inline-flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-emerald-400/70" />
                <span>MCP endpoint for agents</span>
              </li>
            </ul>
          </section>

          {/* RIGHT — compact payouts board */}
          {top.length > 0 && (
            <div className="w-full max-w-md lg:max-w-none lg:ml-auto lg:w-[26rem] xl:w-[28rem] animate-[fadeUp_.9s_ease-out_.15s_both]">
              <TopPayoutsPanel top={top} />
            </div>
          )}
        </div>
        </div>

        {s && (
          <div className="pb-16 pt-10 border-t border-neutral-900/70 animate-[fadeUp_1.1s_ease-out_.3s_both]">
            <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-6 text-left">
              <Stat label="Programs" value={s.programs.toLocaleString()} />
              <Stat label="Paying bounties" value={s.bountyPrograms.toLocaleString()} accent />
              <Stat label="In-scope assets" value={s.inScopeAssets.toLocaleString()} />
              <Stat label="Platforms" value={String(s.platforms)} />
              <Stat label="Ingest" value={relativeTime(s.lastIngestAt)} muted />
            </dl>
          </div>
        )}
      </div>

      {/* Corner frame markers — editorial detail, not decorative glow */}
      <CornerMark position="top-left" />
      <CornerMark position="top-right" />
      <CornerMark position="bottom-left" />
      <CornerMark position="bottom-right" />
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

function TopPayoutsPanel({ top }: { top: Awaited<ReturnType<typeof topPayouts>> }) {
  return (
    <div className="relative">
      <div className="relative border border-neutral-800 bg-neutral-950/80 rounded-xl backdrop-blur-md overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 border-b border-neutral-900 bg-neutral-950/90">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-neutral-800 border border-neutral-700" />
            <span className="w-2 h-2 rounded-full bg-neutral-800 border border-neutral-700" />
            <span className="w-2 h-2 rounded-full bg-neutral-800 border border-neutral-700" />
          </div>
          <div className="flex-1 mono text-[10px] text-neutral-500 truncate px-2 py-0.5 bg-neutral-900/60 border border-neutral-900 rounded text-center">
            bounty.index/programs?sort=reward
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-900 gap-2">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="text-emerald-300">Top 5 payouts</span>
            <span className="text-neutral-700">·</span>
            <span className="text-neutral-400 truncate">right now</span>
          </div>
          <Link href="/programs?sort=reward" className="text-xs text-neutral-400 hover:text-emerald-300 transition">
            all →
          </Link>
        </div>
        <ol>
          {top.map((p, i) => (
            <li key={p.id} className={i === top.length - 1 ? '' : 'border-b border-neutral-900'}>
              <Link
                href={`/programs/${p.platform}/${p.slug}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-900/60 active:bg-neutral-900/80 transition group"
              >
                <span className="mono text-[10px] text-neutral-600 w-3.5 tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-100 truncate group-hover:text-emerald-400 transition">{p.name}</p>
                  <p className="mono text-[10px] text-neutral-500 mt-0.5">{platformLabel(p.platform)}</p>
                </div>
                <p className="mono text-sm text-neutral-100 shrink-0 tabular-nums font-medium">
                  {formatBounty(p.maxBounty, p.currency ?? 'USD')}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
