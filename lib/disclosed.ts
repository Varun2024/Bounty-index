// Real payouts — honest per-program view over disclosed reports (PLAN_DISCLOSED_REPORTS §8).
//
// The arkadiyt mirror has only STATED max. Disclosed reports are the one public record of what a
// program ACTUALLY paid. But the display is not the moat (a forker can re-scrape H1 and recompute
// the same numbers), so this module's job is twofold:
//   1. realPayout()  — the honest distribution, gated by sample size so thin data never poses as a stat.
//   2. summarizeRealPayouts() — fuses the payouts with OUR snapshot timeline (wentPaidAt). "We flagged
//      it paid on X; first real disclosed payout Y" is the unreconstructable derivative (rule 3).
//
// Two-tier threshold (why): only ~17% of disclosed reports carry an amount, and a median over a
// handful of points is noise. Individual amounts show at N>=3; a median/percentile aggregate only at
// N>=8. Every amount renders WITH its disclosure date so staleness is visible, never hidden.
//
// ponytail: pure functions + a static FX table. No orm, no deps. Mirrors lib/opportunity.ts.

export const INDIVIDUAL_MIN_N = 3; // show individual disclosed amounts at/above this
export const AGGREGATE_MIN_N = 8; // show median + p25/p75 only at/above this

// Static USD conversion for ranking/comparison only (a ponytail: corner — rates drift, but the
// vast majority of H1 disclosed amounts are already USD). Unknown currency is treated as USD.
const FX_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, AUD: 0.66, SGD: 0.74, INR: 0.012, BRL: 0.18, JPY: 0.0065,
};

// Returns null for an unmapped NON-null currency so the caller excludes the row rather than
// silently counting it as USD (which would poison the median — e.g. 100000 KRW is ~$72, not
// $100000). A null/absent currency is treated as USD (H1's default when none is stated).
export function toUsd(amount: number, currency: string | null | undefined): number | null {
  if (currency == null) return Math.round(amount);
  const rate = FX_TO_USD[currency.toUpperCase()];
  return rate == null ? null : Math.round(amount * rate);
}

// Count disclosed reports that carry a usable (currency-mappable) amount — matches the card's own
// n, so a caller gating UI on this never disagrees with what the card renders.
export function countDisclosedAmounts(reports: Array<{ bountyAmount: number | null; currency: string | null }>): number {
  return reports.reduce(
    (n, r) => (r.bountyAmount != null && r.bountyAmount > 0 && toUsd(r.bountyAmount, r.currency) != null ? n + 1 : n),
    0,
  );
}

// Minimal shape the view needs — a subset of disclosed_reports columns.
export interface DisclosedInput {
  externalId: string;
  bountyAmount: number | null;
  currency: string | null;
  disclosedAt: Date | string;
  severity: string | null;
  title: string | null;
}

export interface PayoutItem {
  externalId: string;
  usd: number; // normalized, for sort/compare
  amount: number; // original disclosed amount
  currency: string;
  disclosedAt: Date;
  severity: string | null;
  title: string | null;
}

export interface RealPayoutView {
  n: number; // disclosed reports WITH a public amount
  totalReports: number; // all disclosed reports (incl. amount-hidden)
  items: PayoutItem[]; // amount-bearing, sorted by usd desc
  median: number | null; // USD — only when n >= AGGREGATE_MIN_N
  p25: number | null;
  p75: number | null;
  spanFrom: Date | null; // earliest / latest disclosure among amount items
  spanTo: Date | null;
  confirmedPaidAt: Date | null; // earliest amount-bearing disclosure = "paying since"
  wentPaidAt: Date | null; // when WE observed the VDP->paid flip (snapshot timeline)
  statedMaxUsd: number | null;
  realVsStated: 'below' | 'near' | 'above' | null; // median vs stated max, only when median exists
}

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

// Linear-interpolated percentile on an ascending array (good enough for a display band).
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return Math.round(sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo));
}

export interface SummarizeOpts {
  statedMax?: number | null;
  statedCurrency?: string | null;
  wentPaidAt?: Date | null;
}

export function summarizeRealPayouts(reports: DisclosedInput[], opts: SummarizeOpts = {}): RealPayoutView {
  const items: PayoutItem[] = reports
    .filter((r) => r.bountyAmount != null && r.bountyAmount > 0)
    .map((r): PayoutItem | null => {
      const usd = toUsd(r.bountyAmount as number, r.currency);
      if (usd == null) return null; // unmapped currency — exclude rather than mis-count as USD
      return {
        externalId: r.externalId,
        usd,
        amount: r.bountyAmount as number,
        currency: (r.currency ?? 'USD').toUpperCase(),
        disclosedAt: asDate(r.disclosedAt),
        severity: r.severity,
        title: r.title,
      };
    })
    .filter((x): x is PayoutItem => x !== null)
    .sort((a, b) => b.usd - a.usd);

  const n = items.length;
  const usdAsc = items.map((i) => i.usd).sort((a, b) => a - b);
  const median = n >= AGGREGATE_MIN_N ? percentile(usdAsc, 0.5) : null;
  const p25 = n >= AGGREGATE_MIN_N ? percentile(usdAsc, 0.25) : null;
  const p75 = n >= AGGREGATE_MIN_N ? percentile(usdAsc, 0.75) : null;

  let spanFrom: Date | null = null;
  let spanTo: Date | null = null;
  let confirmedPaidAt: Date | null = null;
  for (const it of items) {
    if (!spanFrom || it.disclosedAt < spanFrom) spanFrom = it.disclosedAt;
    if (!spanTo || it.disclosedAt > spanTo) spanTo = it.disclosedAt;
  }
  confirmedPaidAt = spanFrom; // earliest amount-bearing disclosure

  const statedMaxUsd = opts.statedMax && opts.statedMax > 0 ? toUsd(opts.statedMax, opts.statedCurrency) : null;
  let realVsStated: RealPayoutView['realVsStated'] = null;
  if (median != null && statedMaxUsd != null && statedMaxUsd > 0) {
    const ratio = median / statedMaxUsd;
    realVsStated = ratio < 0.5 ? 'below' : ratio > 0.9 ? 'above' : 'near';
  }

  return {
    n,
    totalReports: reports.length,
    items,
    median,
    p25,
    p75,
    spanFrom,
    spanTo,
    confirmedPaidAt,
    wentPaidAt: opts.wentPaidAt ?? null,
    statedMaxUsd,
    realVsStated,
  };
}

// Self-check — `npx tsx lib/disclosed.ts`. Dependency-free, runs with the DB offline.
if (require.main === module) {
  const mk = (amount: number | null, iso: string, cur = 'USD'): DisclosedInput => ({
    externalId: `${amount}-${iso}`, bountyAmount: amount, currency: cur, disclosedAt: iso, severity: 'high', title: 't',
  });
  const checks: Array<[string, boolean]> = [];

  // Below the individual tier: 2 amounts → n counted, no aggregate.
  const few = summarizeRealPayouts([mk(1000, '2024-01-01'), mk(3000, '2024-02-01'), mk(null, '2024-03-01')]);
  checks.push(['n counts only amount-bearing', few.n === 2]);
  checks.push(['totalReports counts all', few.totalReports === 3]);
  checks.push(['no median below N>=8', few.median === null]);
  checks.push(['confirmedPaidAt is earliest', few.confirmedPaidAt?.getUTCFullYear() === 2024 && few.confirmedPaidAt?.getUTCMonth() === 0]);

  // Aggregate tier: 8 amounts 1000..8000 → median between, percentiles present.
  const many = summarizeRealPayouts(
    Array.from({ length: 8 }, (_, i) => mk((i + 1) * 1000, `2023-0${(i % 9) + 1}-01`)),
    { statedMax: 50_000 },
  );
  checks.push(['median present at N=8', typeof many.median === 'number']);
  checks.push(['p25 < median < p75', (many.p25 ?? 0) < (many.median ?? 0) && (many.median ?? 0) < (many.p75 ?? 0)]);
  checks.push(['median far below stated → below', many.realVsStated === 'below']);
  checks.push(['items sorted usd desc', many.items[0].usd >= many.items[1].usd]);

  // FX: EUR converts, null currency = USD face, unmapped currency excluded (null).
  checks.push(['EUR→USD > face', (toUsd(1000, 'EUR') ?? 0) > 1000]);
  checks.push(['null currency = USD face', toUsd(1000, null) === 1000]);
  checks.push(['unmapped currency excluded', toUsd(1000, 'KRW') === null]);

  // Rows with an unmapped currency drop out of items (not counted as USD).
  const mixedCur = summarizeRealPayouts([mk(1000, '2024-01-01', 'USD'), mk(5_000_000, '2024-02-01', 'KRW'), mk(2000, '2024-03-01', 'USD')]);
  checks.push(['unmapped-currency row excluded from items', mixedCur.n === 2]);
  checks.push(['countDisclosedAmounts matches n', countDisclosedAmounts([
    { bountyAmount: 1000, currency: 'USD' }, { bountyAmount: 5_000_000, currency: 'KRW' }, { bountyAmount: null, currency: 'USD' },
  ]) === 1]);

  // realVsStated 'above' when median near stated.
  const high = summarizeRealPayouts(
    Array.from({ length: 8 }, () => mk(9500, '2023-01-01')),
    { statedMax: 10_000 },
  );
  checks.push(['median near stated → above', high.realVsStated === 'above']);

  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'ok ' : 'FAIL'} ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? 'all disclosed cases passed' : 'FAILURES');
  if (!ok) process.exit(1);
}
