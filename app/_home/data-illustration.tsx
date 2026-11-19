import Link from 'next/link';
import type { PayoutDistribution } from '@/lib/db/queries';
import { PAYOUT_BANDS, bandIndex } from '@/lib/payout-buckets';
import { BucketBars } from '@/app/_ui/bucket-bars';
import { InfoHint } from '@/app/_ui/info-hint';
import { formatBounty, platformLabel } from '@/lib/format';

// The home's two corpus-data panels — real-data illustrations only our own corpus can draw: what
// programs ACTUALLY pay (disclosed-report distribution the upstream mirror can't have) and how wide
// the index reaches. The standalone section wrapper was merged into app/_home/signals.tsx so these
// sit under one header with the live feeds instead of forming a second 2-panel section.

export function PayoutPanel({ dist }: { dist: PayoutDistribution }) {
  const medianBand = dist.median != null ? bandIndex(dist.median) : -1;
  const bars = PAYOUT_BANDS.map((b, i) => ({ label: b.label, value: dist.counts[i], highlight: i === medianBand }));
  return (
    <div className="border border-neutral-900 rounded-xl bg-neutral-950/50 overflow-hidden reveal reveal-delay-1 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-900 bg-neutral-950/70">
        <p className="text-xs text-emerald-300">What they actually pay</p>
        <p className="text-xs text-neutral-400 inline-flex items-center gap-1.5">
          disclosed reports
          <InfoHint label="About these payouts" side="bottom" align="end">
            Real amounts researchers chose to disclose, normalized to USD. The one record the upstream
            list can&rsquo;t have.
          </InfoHint>
        </p>
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between gap-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          {dist.median != null && (
            <>
              <span className="mono text-[11px] uppercase tracking-widest text-neutral-400">median</span>
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
          ariaLabel={`Distribution of ${dist.n} disclosed payouts across amount bands; ${bars.map((b) => `${b.value} in ${b.label}`).join(', ')}.`}
        />
      </div>
      <Link
        href="/payouts"
        className="cta-arrow flex items-center justify-between px-5 py-2.5 border-t border-neutral-900 mono text-xs text-neutral-400 hover:text-emerald-400 hover:bg-neutral-900/30 transition focus-ring"
      >
        what programs actually pay <span className="arrow">→</span>
      </Link>
    </div>
  );
}

export function CoveragePanel({ platforms }: { platforms: { platform: string; programs: number }[] }) {
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
              className="flex-1 h-2.5 rounded-full bg-neutral-900 overflow-hidden"
              role="img"
              aria-label={`${platformLabel(p.platform)}: ${p.programs} programs`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(p.programs / max) * 100}%`,
                  // Solid fills (accent mixed into the surface), not a see-through overlay. The leader
                  // builds from a mid tint to full accent toward its tip (a magnitude cue); the rest
                  // sit a step back so the top platform clearly dominates.
                  background:
                    i === 0
                      ? 'linear-gradient(90deg, color-mix(in srgb, var(--ck-accent) 45%, var(--ck-ring)), var(--ck-accent))'
                      : 'color-mix(in srgb, var(--ck-accent) 38%, var(--ck-ring))',
                }}
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
