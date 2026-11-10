import type { ProgramSnapshot } from '@/lib/db/queries';
import type { DisclosedReportRow } from '@/lib/db/queries';
import { programSignals } from '@/lib/snapshots';
import { summarizeRealPayouts, INDIVIDUAL_MIN_N, type PayoutItem } from '@/lib/disclosed';
import { formatBounty } from '@/lib/format';
import { ExternalIcon } from '@/app/_ui/icons';
import { BucketBars } from '@/app/_ui/bucket-bars';
import { PAYOUT_BANDS, bandIndex, bucketize } from '@/lib/payout-buckets';

interface RealPayoutsProps {
  reports: DisclosedReportRow[];
  snapshots: ProgramSnapshot[];
  platform: string;
  statedMax: number | null;
  statedCurrency: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ROW_CAP = 8;

function monthYear(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Public report URL, rebuilt from the stable external id (no payload needed). Only H1 for now.
function reportHref(platform: string, externalId: string): string | null {
  if (platform === 'hackerone' && /^\d+$/.test(externalId)) return `https://hackerone.com/reports/${externalId}`;
  return null;
}

// The real record of what a program actually paid — the one thing the upstream mirror (stated max
// only) cannot have. Gated so thin data never poses as a statistic: individual amounts at N>=3, a
// median/percentile band only at N>=8. Every amount shows its disclosure date, so staleness is
// visible. The lead line fuses the payouts with OUR snapshot timeline — the part a fresh fork lacks.
export function RealPayouts({ reports, snapshots, platform, statedMax, statedCurrency }: RealPayoutsProps) {
  // Scan ALL snapshot history (windowDays=Infinity), not the default 90-day window — a VDP→paid
  // flip we want to surface is usually older than 90 days, and an unbounded window is also
  // time-independent so the card doesn't flicker when ISR regenerates.
  const wentPaidAt = programSignals(snapshots, Infinity).wentPaidAt;
  const v = summarizeRealPayouts(reports, { statedMax, statedCurrency, wentPaidAt });

  // Below the individual tier, a couple of points imply nothing — stay silent rather than over-claim.
  if (v.n < INDIVIDUAL_MIN_N) return null;

  const shown = v.items.slice(0, ROW_CAP);
  const extra = v.n - shown.length;
  const capped = extra > 0;

  return (
    <section
      id="payouts"
      className="mt-10 scroll-mt-28 border border-neutral-900 rounded-xl bg-neutral-950/50 overflow-hidden reveal reveal-delay-1"
      aria-label="Real disclosed payouts"
    >
      <div className="px-5 py-4 md:px-6 md:py-5 space-y-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-400">real payouts</h2>
          <span className="mono text-[10px] text-neutral-400">
            {v.n} disclosed amount{v.n === 1 ? '' : 's'}
            {v.spanFrom && v.spanTo ? ` · ${monthYear(v.spanFrom)}–${monthYear(v.spanTo)}` : ''}
          </span>
        </div>

        {/* Fusion line: what only our own history can anchor. */}
        <PayoutContext view={v} />

        {/* Aggregate band — only earns a place at N>=8. */}
        {v.median != null && (
          <div className="border-t border-neutral-900 pt-3 space-y-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="mono text-[10px] uppercase tracking-widest text-neutral-400">typical</span>
              <span className="mono text-xl text-emerald-300 tabular-nums">{formatBounty(v.median)}</span>
              {v.p25 != null && v.p75 != null && (
                <span className="mono text-xs text-neutral-400 tabular-nums">
                  middle half {formatBounty(v.p25)} – {formatBounty(v.p75)}
                </span>
              )}
            </div>
            {/* The shape a lone median hides: where the real payouts actually cluster + the tail. */}
            <PayoutHistogram items={v.items} median={v.median} />
          </div>
        )}

        {/* Individual disclosed amounts — largest first (the band above carries the honest center). */}
        <div className="space-y-1.5">
          <div className="mono text-[10px] uppercase tracking-widest text-neutral-400">
            {capped ? 'largest disclosed' : 'disclosed payouts'}
          </div>
          <ul className="divide-y divide-neutral-900/70">
            {shown.map((it) => (
              <PayoutRow key={it.externalId} item={it} platform={platform} />
            ))}
          </ul>
          {capped && (
            <p className="mono text-[10px] text-neutral-400 pt-1">+{extra} more disclosed payout{extra === 1 ? '' : 's'}</p>
          )}
        </div>

        <p className="mono text-[10px] text-neutral-400 leading-relaxed">
          based on {v.n} disclosed report{v.n === 1 ? '' : 's'} where the researcher revealed the amount. only what
          was chosen to be public, not every payout. amounts normalized to USD for comparison.
        </p>
      </div>
    </section>
  );
}

function PayoutContext({ view }: { view: ReturnType<typeof summarizeRealPayouts> }) {
  // Only surface our observed VDP→paid flip when it actually corroborates — i.e. it isn't predated
  // by a real disclosed payout. Our snapshot history is young; a "flip" years after the program was
  // already paying is a capture artifact, not a catch. (The header already shows the payout span, so
  // we don't restate "paying since" here.)
  const flip =
    view.wentPaidAt && (!view.confirmedPaidAt || view.wentPaidAt <= view.confirmedPaidAt)
      ? `we saw it flip to paid ${monthYear(view.wentPaidAt)}`
      : null;

  // Stated ceiling vs real median — both in USD so the comparison is like-for-like.
  let statedLine: string | null = null;
  if (view.realVsStated && view.median != null && view.statedMaxUsd != null) {
    const word = view.realVsStated === 'below' ? 'well below' : view.realVsStated === 'above' ? 'near or above' : 'below';
    statedLine = `typical real payout sits ${word} the ${formatBounty(view.statedMaxUsd)} stated ceiling`;
  }

  if (!flip && !statedLine) return null;
  return (
    <div className="space-y-1">
      {flip && <p className="mono text-xs text-emerald-300/90">{flip}</p>}
      {statedLine && <p className="mono text-xs text-neutral-300">{statedLine}</p>}
    </div>
  );
}

// Distribution of this program's disclosed payouts across the shared bounty bands — the shape a
// lone median hides. The band holding the median is highlighted; see app/_ui/bucket-bars.tsx.
function PayoutHistogram({ items, median }: { items: PayoutItem[]; median: number }) {
  const counts = bucketize(items.map((it) => it.usd));
  const medianBand = bandIndex(median);
  const bars = PAYOUT_BANDS.map((b, i) => ({ label: b.label, value: counts[i], highlight: i === medianBand }));
  return (
    <BucketBars
      bars={bars}
      unit="payouts"
      ariaLabel={`Distribution of ${items.length} disclosed payouts across amount bands; ${bars.map((b) => `${b.value} in ${b.label}`).join(', ')}.`}
    />
  );
}

function PayoutRow({ item, platform }: { item: PayoutItem; platform: string }) {
  const href = reportHref(platform, item.externalId);
  const sev = item.severity && item.severity !== 'none' ? item.severity : null;
  // Pin the locale: a bare toLocaleString() differs server vs client and breaks hydration.
  const native = item.currency !== 'USD' ? ` ${item.amount.toLocaleString('en-US')} ${item.currency}` : '';
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="mono text-sm text-emerald-300 tabular-nums w-16 shrink-0">{formatBounty(item.usd)}</span>
      <span className="mono text-[11px] text-neutral-400 w-20 shrink-0">{monthYear(item.disclosedAt)}</span>
      {sev && <span className="mono text-[10px] uppercase tracking-wide text-neutral-400 w-16 shrink-0">{sev}</span>}
      <span className="text-sm text-neutral-300 truncate min-w-0 flex-1" title={item.title ?? undefined}>
        {item.title ?? 'disclosed report'}
        {native && <span className="mono text-[10px] text-neutral-400">{native}</span>}
      </span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="focus-ring text-neutral-400 hover:text-emerald-300 transition shrink-0"
          aria-label={`Open disclosed report${item.title ? `: ${item.title}` : ''} on the source platform`}
        >
          <ExternalIcon size={12} />
        </a>
      )}
    </li>
  );
}
