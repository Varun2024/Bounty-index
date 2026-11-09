import type { ProgramSnapshot } from '@/lib/db/queries';
import type { DisclosedReportRow } from '@/lib/db/queries';
import { programSignals } from '@/lib/snapshots';
import { summarizeRealPayouts, INDIVIDUAL_MIN_N, type PayoutItem } from '@/lib/disclosed';
import { formatBounty } from '@/lib/format';
import { ExternalIcon } from '@/app/_ui/icons';
import { CHART } from '@/app/_ui/chart';

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
          based on {v.n} disclosed report{v.n === 1 ? '' : 's'} where the researcher revealed the amount — only what
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

// Bounty buckets, low→high. Each covers [min, max); the last is open-ended. One series (counts),
// so it's a single-accent magnitude chart — no legend, the title names it. The bucket holding the
// median is at full accent; the rest recede, so the eye reads "where payouts cluster" at a glance.
const PAYOUT_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '<$500', min: 0, max: 500 },
  { label: '$500–1k', min: 500, max: 1000 },
  { label: '$1–5k', min: 1000, max: 5000 },
  { label: '$5–10k', min: 5000, max: 10000 },
  { label: '$10–25k', min: 10000, max: 25000 },
  { label: '$25k+', min: 25000, max: Infinity },
];

function PayoutHistogram({ items, median }: { items: PayoutItem[]; median: number }) {
  const counts = PAYOUT_BUCKETS.map((b) => items.filter((it) => it.usd >= b.min && it.usd < b.max).length);
  const peak = Math.max(1, ...counts);
  const medianBucket = PAYOUT_BUCKETS.findIndex((b) => median >= b.min && median < b.max);

  const SLOT = 10, BAR = 8, PLOT = 48, TOP = 3;
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${PAYOUT_BUCKETS.length * SLOT} ${PLOT + TOP}`}
        preserveAspectRatio="none"
        className="w-full h-14"
        role="img"
        aria-label={`Distribution of ${items.length} disclosed payouts across amount bands; ${PAYOUT_BUCKETS.map((b, i) => `${counts[i]} in ${b.label}`).join(', ')}.`}
      >
        <line x1={0} y1={TOP + PLOT} x2={PAYOUT_BUCKETS.length * SLOT} y2={TOP + PLOT} stroke={CHART.baseline} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        {counts.map((n, i) => {
          const h = (n / peak) * PLOT;
          return (
            <rect
              key={i}
              x={i * SLOT}
              y={TOP + (PLOT - h)}
              width={BAR}
              height={h}
              rx={1.5}
              fill={n === 0 ? CHART.zero : i === medianBucket ? CHART.accent : CHART.accentMuted}
            >
              <title>{`${PAYOUT_BUCKETS[i].label}: ${n} payout${n === 1 ? '' : 's'}${i === medianBucket ? ' · median here' : ''}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex mt-1">
        {PAYOUT_BUCKETS.map((b, i) => (
          <span
            key={b.label}
            className={`mono text-[8px] tabular-nums text-center ${i === medianBucket ? 'text-emerald-300' : 'text-neutral-400'}`}
            style={{ width: `${100 / PAYOUT_BUCKETS.length}%` }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </figure>
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
