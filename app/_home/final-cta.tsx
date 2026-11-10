import Link from 'next/link';
import Image from 'next/image';
import { stats } from '@/lib/db/queries';
import { SectionEyebrow } from './shared';

interface FinalCTAProps {
  s: Awaited<ReturnType<typeof stats>> | null;
}

export function FinalCTA({ s }: FinalCTAProps) {
  return (
    <section className="border-t border-neutral-900 relative overflow-hidden">
      <div className="relative max-w-[1200px] mx-auto px-6 py-16 md:py-20">
        <div className="grid items-center gap-10 lg:gap-16 lg:grid-cols-[1.25fr_1fr]">
          {/* Copy column */}
          <div className="text-center lg:text-left order-last lg:order-first">
            <SectionEyebrow n="04" label="Start hunting" />
            <h2 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight text-neutral-50 leading-[1]">
              {s ? (
                <>
                  <span className="mono text-emerald-300 tabular-nums">{s.bountyPrograms.toLocaleString()}</span> programs<br />
                  are <span className="text-neutral-400">paying bounties</span><br />
                  right now.
                </>
              ) : (
                'Start hunting.'
              )}
            </h2>
            <p className="text-neutral-300 mt-7 max-w-lg mx-auto lg:mx-0">
              Filter the list, save an RSS, find the ones that fit your stack. Fuzz keeps the index on the scent. Thanks for hunting with it.
            </p>
            <div className="mt-9 flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link
                href="/programs?hasBounty=1&sort=reward"
                className="cta-arrow mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition focus-ring"
              >
                browse paying programs <span className="arrow">→</span>
              </Link>
              <Link
                href="/scope-lookup"
                className="mono text-sm px-5 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md hover:border-neutral-600 hover:bg-neutral-900 transition"
              >
                check a domain
              </Link>
            </div>
            <p className="mt-8 text-sm text-neutral-400">
              Curious how it&rsquo;s built?{' '}
              <Link href="/how-it-works" className="text-neutral-200 hover:text-emerald-300 transition underline underline-offset-4 decoration-neutral-700">
                how it works →
              </Link>
            </p>
          </div>

          {/* Fuzz column */}
          <div className="order-first lg:order-last flex flex-col items-center lg:items-end gap-3">
            <Image
              src="/fuzz-found.png"
              alt="Fuzz, bounty.index's scope hound, picking up a fresh bounty"
              width={420}
              height={420}
              className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80"
            />
            <p className="mono text-[11px] text-neutral-500 text-center lg:text-right">
              Fuzz, your scope hound. He finds the scent so you can take the shot.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
