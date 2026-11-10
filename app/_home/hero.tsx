import Link from 'next/link';
import Image from 'next/image';
import { stats, topPayouts } from '@/lib/db/queries';
import { formatBounty, relativeTime } from '@/lib/format';
import { HeroScopeCheck } from './hero-scope-check';

interface HeroProps {
  s: Awaited<ReturnType<typeof stats>> | null;
  top: Awaited<ReturnType<typeof topPayouts>>;
  mcpRequests: number;
  bgIdentifiers: string[];
}

// Illustration-forward hero: Fuzz tracking a bug through the index is the dominant visual (the scene
// carries the right half and bleeds off the edge, like a real product hero), with the confident
// positioning line and the live scope check overlaid on the darker left. The old faint-identifier
// backdrop is gone; the scene is the atmosphere now.
export function Hero({ s, top, mcpRequests }: HeroProps) {
  const lastIngest = s?.lastIngestAt ? relativeTime(s.lastIngestAt) : null;
  const programCount = s?.programs.toLocaleString() ?? null;
  const platformCount = s?.platforms ?? 6;
  const topProgram = top[0] ?? null;

  return (
    <section className="relative overflow-hidden">
      {/* Desktop: the hunt scene covers the hero, anchored right so Fuzz + the bug stay in view and
          bleed off the edge. Scrims keep the left text readable and fade the scene into the page. */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        <Image src="/fuzz-hero.webp" alt="" fill priority sizes="100vw" className="object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b] from-30% via-[#0a0a0b]/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0a0a0b] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0a0a0b] to-transparent" />
      </div>

      <div className="relative max-w-[1280px] mx-auto px-6">
        {/* Mobile: the scene leads, bleeding full-width and fading down into the headline so it reads
            as one composition (desktop uses the absolute background above instead). */}
        <div className="lg:hidden -mx-6 relative">
          <Image
            src="/fuzz-hero.webp"
            alt="Fuzz, the scope hound, following a scent trail to a bug across the index"
            width={1600}
            height={1600}
            priority
            className="w-full h-auto"
          />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a0a0b] to-transparent" />
        </div>

        <div className="max-w-xl -mt-12 pb-10 lg:mt-0 lg:pt-24 lg:pb-24 lg:min-h-[88vh] lg:flex lg:flex-col lg:justify-center animate-[fadeUp_.7s_ease-out_both]">
          {/* Trust line, above the headline on desktop; hidden on mobile so the headline sits
              directly on the scene's fading edge. */}
          <p className="hidden lg:flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
            <span>
              <span className="mono tabular-nums text-neutral-200">2,000+</span> hunters / week
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
          </p>

          <h1 className="lg:mt-6 lowercase text-[2.75rem] sm:text-5xl lg:text-6xl xl:text-[4rem] font-medium tracking-[-0.035em] leading-[0.95] text-neutral-50">
            every <span className="text-neutral-400">public bounty program,</span> one{' '}
            <span className="bg-gradient-to-br from-emerald-200 to-emerald-500 bg-clip-text text-transparent">index.</span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-neutral-300 leading-snug">
            {programCount ? (
              <>
                <span className="mono text-neutral-100 tabular-nums">{programCount}</span> programs across{' '}
                <span className="mono text-neutral-100 tabular-nums">{platformCount}</span> platforms. Fuzz checks any domain against all of them, live.
              </>
            ) : (
              <>Every public bug bounty program across seven platforms, in one index.</>
            )}
          </p>

          {/* The live action. */}
          <HeroScopeCheck programCount={programCount} />

          {/* Quiet secondary row: the agent surface, and one data hook into the leaderboard. */}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            <Link
              href="/mcp"
              className="group inline-flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 py-2 pl-3 pr-3.5 transition hover:border-emerald-800/70 hover:bg-neutral-900/70 focus-ring"
            >
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="text-neutral-300 group-hover:text-neutral-100 transition">MCP endpoint for agents</span>
              {mcpRequests > 0 && (
                <>
                  <span aria-hidden className="text-neutral-700">·</span>
                  <span className="mono tabular-nums text-emerald-300">{mcpRequests.toLocaleString()}</span>
                  <span className="text-neutral-400">served</span>
                </>
              )}
            </Link>
            {topProgram && (
              <Link
                href="/programs?sort=reward"
                className="group inline-flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition focus-ring rounded"
              >
                <span>biggest right now</span>
                <span className="mono tabular-nums text-emerald-300">
                  up to {formatBounty(topProgram.maxBounty, topProgram.currency ?? 'USD')}
                </span>
                <span aria-hidden className="text-emerald-400/70 transition group-hover:translate-x-0.5">→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
