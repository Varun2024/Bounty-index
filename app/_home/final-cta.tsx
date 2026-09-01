import Link from 'next/link';
import { stats } from '@/lib/db/queries';
import { SectionEyebrow } from './shared';

interface FinalCTAProps {
  s: Awaited<ReturnType<typeof stats>> | null;
}

export function FinalCTA({ s }: FinalCTAProps) {
  return (
    <section className="border-t border-neutral-900 relative overflow-hidden">
      <div
        className="absolute pointer-events-none inset-x-0 -bottom-40 h-80 opacity-30"
        style={{ background: 'radial-gradient(ellipse 60% 100% at 50% 100%, #34d399 0%, transparent 70%)' }}
      />
      <div className="relative max-w-[1200px] mx-auto px-6 py-28 text-center">
        <SectionEyebrow n="04" label="Start hunting" centered />
        <h2 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-neutral-50 max-w-3xl mx-auto leading-[1]">
          {s ? (
            <>
              <span className="mono text-emerald-300 tabular-nums">{s.bountyPrograms.toLocaleString()}</span> programs<br />
              are <span className="text-neutral-500">paying bounties</span><br />
              right now.
            </>
          ) : (
            'Start hunting.'
          )}
        </h2>
        <p className="text-neutral-400 mt-8 max-w-lg mx-auto">
          Filter the list, save an RSS, find the ones that fit your stack.
        </p>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <Link
            href="/programs?hasBounty=1&sort=reward"
            className="cta-arrow mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition shadow-[0_0_50px_-8px] shadow-emerald-400/70 focus-ring"
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
      </div>
    </section>
  );
}
