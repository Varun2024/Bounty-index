import type { Metadata } from 'next';
import Link from 'next/link';
import { disclosedPayoutDistribution, realPayoutsReport } from '@/lib/db/queries';
import { PAYOUT_BANDS, bandIndex } from '@/lib/payout-buckets';
import { BucketBars } from '@/app/_ui/bucket-bars';
import { formatBounty } from '@/lib/format';

export const metadata: Metadata = {
  title: 'What bug bounty programs actually pay · Bounty Index',
  description:
    'Real bounty amounts from disclosed HackerOne reports, normalized to USD and ranked by median. The headline "up to $50k" is an outlier; this is what a program typically pays. Not all payouts, only the ones researchers disclosed.',
  alternates: { canonical: '/payouts' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthYear(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Report surface over the disclosed-report corpus (PLAN_DISCLOSED_REPORTS). The home page shows a
// compact version of the distribution; this is the full, shareable, indexable breakdown — the one
// view only our corpus can draw, with the honesty rails (N, selection bias, "not all payouts") made
// first-class. Data-fetch failures degrade to an honest "not available" state, never fake numbers.
export default async function PayoutsPage() {
  const [dist, report] = await Promise.all([
    disclosedPayoutDistribution().catch(() => null),
    realPayoutsReport().catch(() => null),
  ]);

  const hasCorpus = dist != null && dist.n > 0;
  const hasRanking = report != null && report.rows.length > 0;
  const medianBand = hasCorpus && dist!.median != null ? bandIndex(dist!.median) : -1;
  const bars = PAYOUT_BANDS.map((b, i) => ({
    label: b.label,
    value: hasCorpus ? dist!.counts[i] : 0,
    highlight: i === medianBand,
  }));
  const span =
    report?.spanFrom && report?.spanTo ? `${monthYear(report.spanFrom)}–${monthYear(report.spanTo)}` : null;

  return (
    <div className="max-w-[960px] mx-auto px-6 py-10">
      <header className="border-b border-neutral-900 pb-6 reveal">
        <p className="mono text-[11px] uppercase tracking-widest text-neutral-400 mb-2">
          Data · disclosed HackerOne reports
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">
          What programs actually pay
        </h1>
        <p className="text-neutral-300 mt-3 max-w-2xl leading-relaxed">
          Program pages love a big ceiling &mdash; &ldquo;up to $50,000&rdquo;. That number is almost
          always an outlier. Below is what programs <em>typically</em>{' '}pay, taken from the bounty amounts
          researchers chose to disclose on their reports, normalized to USD. It is the one record the
          public program list can&rsquo;t give you.
        </p>
      </header>

      {!hasCorpus && !hasRanking ? (
        <p className="mt-10 text-neutral-400">
          The disclosed-payout data isn&rsquo;t available right now. Try again in a moment, or{' '}
          <Link href="/programs" className="text-emerald-400 hover:underline">
            browse the index
          </Link>
          .
        </p>
      ) : (
        <>
          {hasCorpus && (
            <section className="mt-10 reveal reveal-delay-1">
              <div className="grid grid-cols-3 gap-4 mb-8">
                <Stat
                  label="median payout"
                  value={dist!.median != null ? formatBounty(dist!.median) : '—'}
                  accent
                />
                <Stat label="disclosed amounts" value={dist!.n.toLocaleString()} />
                <Stat label="programs" value={dist!.programs.toLocaleString()} />
              </div>

              <div className="border border-neutral-900 rounded-xl bg-neutral-950/50 p-5 md:p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-lg font-semibold text-neutral-100">The whole distribution</h2>
                  <p className="mono text-[11px] text-neutral-400 tabular-nums">
                    {dist!.n.toLocaleString()} payouts{span ? ` · ${span}` : ''}
                  </p>
                </div>
                <BucketBars
                  bars={bars}
                  unit="payouts"
                  ariaLabel={`Distribution of ${dist!.n} disclosed payouts across amount bands; ${bars
                    .map((b) => `${b.value} in ${b.label}`)
                    .join(', ')}.`}
                />
                <p className="text-sm text-neutral-400 mt-4 leading-relaxed">
                  Most disclosed bounties land in the low-thousands. The six-figure headlines are the far
                  right tail, not the middle.
                </p>
              </div>
            </section>
          )}

          {hasRanking && (
            <section className="mt-12 reveal reveal-delay-2">
              <h2 className="text-xl font-semibold text-neutral-100">What the busiest programs pay</h2>
              <p className="text-sm text-neutral-400 mt-2 mb-5 max-w-2xl leading-relaxed">
                Programs with at least 8 disclosed amounts, ranked by median. The{' '}
                <span className="text-neutral-200">top</span>{' '}column is the single biggest disclosed bounty
                &mdash; look how far it sits above the median. That gap is the whole point.
              </p>
              <div className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-900 bg-neutral-950/60">
                      <th className="text-left px-4 py-3 mono text-[11px] uppercase tracking-widest text-neutral-400 font-normal">
                        Program
                      </th>
                      <th className="text-right px-4 py-3 mono text-[11px] uppercase tracking-widest text-emerald-400 font-normal w-24">
                        Median
                      </th>
                      <th className="text-right px-4 py-3 mono text-[11px] uppercase tracking-widest text-neutral-400 font-normal w-24">
                        Top
                      </th>
                      <th className="text-right px-4 py-3 mono text-[11px] uppercase tracking-widest text-neutral-400 font-normal w-20">
                        Reports
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report!.rows.map((r) => (
                      <tr key={`${r.platform}/${r.slug}`} className="border-b border-neutral-900 last:border-b-0 hover:bg-neutral-900/30 transition">
                        <td className="px-4 py-3 text-sm">
                          <Link
                            href={`/programs/${r.platform}/${r.slug}`}
                            className="text-neutral-100 hover:text-emerald-400 transition focus-ring rounded"
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 mono text-sm text-right tabular-nums text-emerald-300">
                          {formatBounty(r.median)}
                        </td>
                        <td className="px-4 py-3 mono text-xs text-right tabular-nums text-neutral-400">
                          {formatBounty(r.top)}
                        </td>
                        <td className="px-4 py-3 mono text-xs text-right tabular-nums text-neutral-400">
                          {r.n.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-12 border border-neutral-900 rounded-lg p-5 bg-neutral-950/40 reveal">
            <h2 className="text-base font-semibold text-neutral-100 mb-3">How to read this</h2>
            <ul className="text-sm text-neutral-400 leading-relaxed space-y-2 list-disc pl-5">
              <li>
                <strong className="text-neutral-200">Source:</strong> publicly disclosed HackerOne reports
                that stated a bounty amount. Other platforms are indexed on the site but don&rsquo;t expose
                per-report amounts the same way, so they aren&rsquo;t here yet.
              </li>
              <li>
                <strong className="text-neutral-200">Not all payouts.</strong> This is only what researchers
                chose to disclose, which skews toward the notable ones. Treat it as a floor on reality, not
                a complete ledger.
              </li>
              <li>
                <strong className="text-neutral-200">USD-normalized</strong> for comparison; a handful of
                non-USD, non-convertible amounts are excluded rather than mis-counted.
              </li>
              <li>
                <strong className="text-neutral-200">Aggregates need a sample.</strong> A program&rsquo;s
                median only appears once it has at least 8 disclosed amounts. Fewer than that is noise.
              </li>
            </ul>
          </section>

          <section className="mt-10 border-t border-neutral-900 pt-6 flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-neutral-400">
              Sort the index by real payout:{' '}
              <Link href="/programs?sort=disclosed" className="text-emerald-400 hover:underline">
                /programs?sort=disclosed
              </Link>
            </p>
            <Link
              href="/programs"
              className="cta-arrow mono text-xs text-neutral-400 hover:text-emerald-400 transition"
            >
              browse the index <span className="arrow">→</span>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-neutral-900 rounded-xl bg-neutral-950/50 px-4 py-4">
      <p className="mono text-[11px] uppercase tracking-widest text-neutral-400">{label}</p>
      <p className={`mono text-2xl mt-1 tabular-nums ${accent ? 'text-emerald-300' : 'text-neutral-100'}`}>
        {value}
      </p>
    </div>
  );
}
