import Link from 'next/link';
import { stats, topPayouts } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';
import { BackdropGrid, BackdropGlow, Stat } from './shared';

interface HeroProps {
  s: Awaited<ReturnType<typeof stats>> | null;
  top: Awaited<ReturnType<typeof topPayouts>>;
}

export function Hero({ s, top }: HeroProps) {
  const topBounty = s && top[0]?.maxBounty ? `$${top[0].maxBounty.toLocaleString()}` : null;
  return (
    <div className="relative overflow-hidden lg:min-h-[calc(100vh-3.5rem)]">
      <div className="parallax-slow absolute inset-0"><BackdropGrid /></div>
      <div className="parallax-fast absolute inset-0"><BackdropGlow /></div>

      <div className="relative max-w-[1200px] mx-auto px-6 flex flex-col min-h-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center py-24 lg:py-20">
          <section className="max-w-3xl animate-[fadeUp_.7s_ease-out_both]">
            <h1 className="text-5xl md:text-6xl xl:text-[5.5rem] font-semibold tracking-[-0.035em] leading-[0.95] text-neutral-50">
              Every public bounty program.{' '}
              <em className="not-italic bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                One index.
              </em>
            </h1>

            <p className="mt-10 text-base md:text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed">
              {s ? (
                <>
                  <span className="mono text-neutral-100 tabular-nums">{s.programs.toLocaleString()}</span> public programs
                  across five platforms — filtered by scope, asset type, and payout.
                  {topBounty && (
                    <>
                      {' '}Top of the leaderboard: <span className="mono text-emerald-300 tabular-nums">{topBounty}</span>.
                    </>
                  )}
                </>
              ) : (
                'Public programs from HackerOne, Bugcrowd, Intigriti, YesWeHack and Federacy — filtered by scope, asset type, and payout.'
              )}
            </p>

            <div className="mt-10 flex flex-wrap gap-3 justify-center">
              <Link
                href="/programs"
                className="cta-arrow mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition shadow-[0_0_50px_-8px] shadow-emerald-400/70 focus-ring"
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
          </section>

          {top.length > 0 && (
            <div className="mt-16 w-full max-w-4xl animate-[fadeUp_.9s_ease-out_.15s_both]">
              <TopPayoutsPanel top={top} />
            </div>
          )}
        </div>

        {s && (
          <div className="pb-12 pt-10 border-t border-neutral-900/70 animate-[fadeUp_1.1s_ease-out_.3s_both]">
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
    </div>
  );
}

function TopPayoutsPanel({ top }: { top: Awaited<ReturnType<typeof topPayouts>> }) {
  return (
    <div className="relative">
      {/* Glow rim behind the frame */}
      <div className="absolute -inset-4 pointer-events-none rounded-2xl bg-gradient-to-br from-emerald-400/10 via-transparent to-transparent blur-2xl opacity-70" />

      <div className="relative border border-neutral-800 bg-neutral-950/80 rounded-xl backdrop-blur-md overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-900 bg-neutral-950/90">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700" />
          </div>
          <div className="flex-1 mono text-[10px] text-neutral-500 truncate px-2 py-1 bg-neutral-900/60 border border-neutral-900 rounded text-center">
            bounty.index/programs?sort=reward
          </div>
        </div>

        <div className="absolute inset-x-0 top-[38px] h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-neutral-900 gap-2">
          <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest min-w-0">
            <span className="text-neutral-600">§</span>
            <span className="text-emerald-400 tabular-nums">TOP · 05</span>
            <span className="text-neutral-500 truncate">payouts · right now</span>
          </div>
          <Link href="/programs?sort=reward" className="mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-emerald-400 transition">
            all →
          </Link>
        </div>
        <ol>
        {top.map((p, i) => (
          <li key={p.id} className={i === top.length - 1 ? '' : 'border-b border-neutral-900'}>
            <Link
              href={`/programs/${p.platform}/${p.slug}`}
              className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-3.5 hover:bg-neutral-900/60 active:bg-neutral-900/80 transition group"
            >
              <span className="mono text-[10px] text-neutral-600 w-4 tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-100 truncate group-hover:text-emerald-400 transition">{p.name}</p>
                <p className="mono text-[11px] text-neutral-500 mt-0.5">{platformLabel(p.platform)}</p>
              </div>
              <p className="mono text-sm md:text-base text-neutral-100 shrink-0 tabular-nums font-medium">
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
