import Link from 'next/link';
import type { PayoutDistribution } from '@/lib/db/queries';
import { PAYOUT_BANDS, bandIndex } from '@/lib/payout-buckets';
import { BucketBars } from '@/app/_ui/bucket-bars';
import { CHART } from '@/app/_ui/chart';
import { formatBounty, platformLabel } from '@/lib/format';

interface DataIllustrationProps {
  dist: PayoutDistribution | null;
  platforms: { platform: string; programs: number }[];
}

// The home's "proof in data" band: two real-data illustrations that only our own corpus can draw.
// Left — what programs ACTUALLY pay (disclosed-report distribution, the thing the upstream mirror
// can't have). Right — how wide the index reaches. Both use the shared chart vocabulary so they
// read as one system with the program pages. Renders nothing if neither has usable data.
export function DataIllustration({ dist, platforms }: DataIllustrationProps) {
  const hasPayouts = dist != null && dist.n >= 8; // same aggregate floor the program card uses
  const hasPlatforms = platforms.length > 0;
  if (!hasPayouts && !hasPlatforms) return null;

  return (
    <section className="border-t border-neutral-900">
      <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-20">
        <div className="mb-10 reveal">
          <p className="text-sm text-neutral-400 mb-2">In the data</p>
          <h2 className="text-3xl md:text-4xl font-semibold text-neutral-50 tracking-tight">What the numbers say.</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-stretch">
          {hasPayouts && <PayoutPanel dist={dist!} />}
          {hasPlatforms && <CoveragePanel platforms={platforms} />}
        </div>
      </div>
    </section>
  );
}

function PayoutPanel({ dist }: { dist: PayoutDistribution }) {
  const medianBand = dist.median != null ? bandIndex(dist.median) : -1;
  const bars = PAYOUT_BANDS.map((b, i) => ({ label: b.label, value: dist.counts[i], highlight: i === medianBand }));
  return (
    <div className="border border-neutral-900 rounded-xl bg-neutral-950/50 overflow-hidden reveal reveal-delay-1 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-900 bg-neutral-950/70">
        <p className="text-xs text-emerald-300">What they actually pay</p>
        <p className="text-xs text-neutral-400">disclosed reports</p>
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between gap-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          {dist.median != null && (
            <>
              <span className="mono text-[10px] uppercase tracking-widest text-neutral-400">median</span>
              <span className="mono text-2xl text-emerald-300 tabular-nums">{formatBounty(dist.median)}</span>
            </>
          )}
          <span className="mono text-[11px] text-neutral-400 tabular-nums">
            {dist.n.toLocaleString()} payouts · {dist.programs.toLocaleString()} programs
          </span>
        </div>
        <BucketBars
          bars={bars}
          unit="payouts"
          heightClass="h-16"
          ariaLabel={`Distribution of ${dist.n} disclosed payouts across amount bands; ${bars.map((b) => `${b.value} in ${b.label}`).join(', ')}.`}
        />
        <p className="mono text-[10px] text-neutral-400 leading-relaxed">
          {'// '}real amounts researchers chose to disclose, normalized to USD. the one record the
          upstream list can&rsquo;t have.
        </p>
      </div>
    </div>
  );
}

function CoveragePanel({ platforms }: { platforms: { platform: string; programs: number }[] }) {
  const sorted = [...platforms].sort((a, b) => b.programs - a.programs);
  const max = Math.max(1, ...sorted.map((p) => p.programs));
  const total = sorted.reduce((s, p) => s + p.programs, 0);
  return (
    <div className="border border-neutral-900 rounded-xl bg-neutral-950/50 overflow-hidden reveal reveal-delay-2 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-900 bg-neutral-950/70">
        <p className="text-xs text-emerald-300">Coverage</p>
        <p className="text-xs text-neutral-400 tabular-nums">{total.toLocaleString()} programs</p>
      </div>
      <ul className="p-5 flex-1 flex flex-col justify-center gap-3">
        {sorted.map((p, i) => (
          <li key={p.platform} className="flex items-center gap-3">
            <span className="mono text-[11px] text-neutral-300 w-24 shrink-0 truncate">{platformLabel(p.platform)}</span>
            <div
              className="flex-1 h-2 rounded-full bg-neutral-900 overflow-hidden"
              role="img"
              aria-label={`${platformLabel(p.platform)}: ${p.programs} programs`}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${(p.programs / max) * 100}%`, background: i === 0 ? CHART.accent : CHART.accentMuted }}
              />
            </div>
            <span className="mono text-xs text-neutral-200 tabular-nums w-12 text-right shrink-0">
              {p.programs.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/programs"
        className="cta-arrow flex items-center justify-between px-5 py-2.5 border-t border-neutral-900 mono text-xs text-neutral-400 hover:text-emerald-400 hover:bg-neutral-900/30 transition focus-ring"
      >
        browse the index <span className="arrow">→</span>
      </Link>
    </div>
  );
}
