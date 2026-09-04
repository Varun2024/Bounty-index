import type { Metadata } from 'next';
import Link from 'next/link';
import { WEIGHTS, opportunityScore } from '@/lib/opportunity';

export const metadata: Metadata = {
  title: 'How the opportunity score works · Bounty Index',
  description:
    'The full public formula behind the Opportunity score. No opaque tiers, no paid gates — just three signals, three weights, one linear sum.',
  alternates: { canonical: '/how-scored' },
};

// Sample rows exercise the interesting corners of the formula so a reader
// can eyeball the shape without re-implementing it.
const now = new Date();
const daysAgo = (n: number): Date => new Date(now.getTime() - n * 86_400_000);

const SAMPLES = [
  { label: 'GitHub-tier · $250k, paying, fresh',    input: { maxBounty: 250_000, offersBounty: true,  lastUpdatedAt: daysAgo(2) } },
  { label: 'Solid · $10k, paying, updated last week', input: { maxBounty: 10_000,  offersBounty: true,  lastUpdatedAt: daysAgo(7) } },
  { label: 'Mid · $2k, paying, ~2 months stale',    input: { maxBounty: 2_000,   offersBounty: true,  lastUpdatedAt: daysAgo(60) } },
  { label: 'VDP with big scope but no cash',        input: { maxBounty: null,    offersBounty: false, lastUpdatedAt: daysAgo(10) } },
  { label: 'Dormant · once-paid, half a year cold', input: { maxBounty: 5_000,   offersBounty: true,  lastUpdatedAt: daysAgo(200) } },
] as const;

export default function HowScoredPage() {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <div className="border-b border-neutral-900 pb-6 reveal">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Methodology · public formula</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">How the opportunity score works</h1>
        <p className="text-neutral-400 mt-3 max-w-2xl leading-relaxed">
          A 0&ndash;100 ranking that tries to answer <em>&ldquo;which programs are worth an hour of my time this week&rdquo;</em>. Three
          signals, three weights, one linear sum &mdash; nothing else, nothing hidden.
        </p>
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">The formula</h2>
        <pre className="mono text-sm bg-neutral-950/60 border border-neutral-900 rounded-lg p-4 overflow-x-auto text-neutral-300 leading-relaxed">
{`score = payout × ${WEIGHTS.payout}
      + bounty × ${WEIGHTS.bounty}
      + freshness × ${WEIGHTS.freshness}`}
        </pre>
        <p className="text-sm text-neutral-500">
          Each axis is normalized to <code className="mono text-neutral-300">0..1</code> and multiplied by its weight, so the max
          possible score is <span className="text-neutral-100 tabular-nums">100</span>.
        </p>
      </section>

      <section className="mt-10 space-y-6">
        <h2 className="text-xl font-semibold text-neutral-100">The three signals</h2>

        <div className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-neutral-100 font-medium">Payout <span className="text-neutral-500 mono text-xs">· {WEIGHTS.payout}%</span></h3>
            <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">log-scale</span>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed">
            <code className="mono text-neutral-200">max_bounty</code> on a natural-log scale between <span className="text-neutral-200 tabular-nums">$500</span> (floor,
            score 0) and <span className="text-neutral-200 tabular-nums">$250,000</span> (ceiling, score 1). Log scale so a $10k
            program isn&rsquo;t drowned out by the handful of six-figure whales.
          </p>
        </div>

        <div className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-neutral-100 font-medium">Bounty vs VDP <span className="text-neutral-500 mono text-xs">· {WEIGHTS.bounty}%</span></h3>
            <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">binary</span>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed">
            <span className="text-emerald-300">+{WEIGHTS.bounty}</span> if the program actually pays cash,
            <span className="text-neutral-600"> 0</span> if it&rsquo;s a VDP (recognition-only). A tiny paying program still beats a
            huge VDP on this axis &mdash; because <em>getting paid</em> is a categorical difference, not a gradient.
          </p>
        </div>

        <div className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-neutral-100 font-medium">Freshness <span className="text-neutral-500 mono text-xs">· {WEIGHTS.freshness}%</span></h3>
            <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">linear decay 30 &rarr; 180 days</span>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Full credit if <code className="mono text-neutral-200">last_updated_at</code> is within 30 days. Linear decay to zero at
            180 days. Everything older, or with no update timestamp at all, gets nothing. A program the platform hasn&rsquo;t touched
            in half a year is probably not paying out.
          </p>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Worked examples</h2>
        <div className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-900 bg-neutral-950/60">
                <th className="text-left px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal">Scenario</th>
                <th className="text-right px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-20">Payout</th>
                <th className="text-right px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-20">Bounty</th>
                <th className="text-right px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-20">Fresh</th>
                <th className="text-right px-4 py-3 mono text-[10px] uppercase tracking-widest text-emerald-400 font-normal w-20">Score</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLES.map((s) => {
                const b = opportunityScore(s.input, now);
                return (
                  <tr key={s.label} className="border-b border-neutral-900 last:border-b-0">
                    <td className="px-4 py-3 text-sm text-neutral-200">{s.label}</td>
                    <td className="px-4 py-3 mono text-xs text-right tabular-nums text-neutral-400">{b.payout.toFixed(1)}</td>
                    <td className="px-4 py-3 mono text-xs text-right tabular-nums text-neutral-400">{b.bounty.toFixed(0)}</td>
                    <td className="px-4 py-3 mono text-xs text-right tabular-nums text-neutral-400">{b.freshness.toFixed(1)}</td>
                    <td className="px-4 py-3 mono text-sm text-right tabular-nums text-emerald-300">{b.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">What&rsquo;s <em>not</em> in the score yet</h2>
        <ul className="text-sm text-neutral-400 leading-relaxed space-y-2 list-disc pl-5">
          <li><strong className="text-neutral-200">Median response time.</strong> Community reports exist but coverage is thin. Adding it now would penalize programs nobody has reported on yet.</li>
          <li><strong className="text-neutral-200">Scope breadth.</strong> The <code className="mono text-neutral-300">in_scope_count</code> lives on snapshots, not on the program row. A denormalization pass is needed before this can be sorted at DB level.</li>
          <li><strong className="text-neutral-200">Safe-harbor status.</strong> Signal is present but too binary at the population level to weight without distorting.</li>
        </ul>
        <p className="text-sm text-neutral-500">These are v2 candidates. If you&rsquo;d weight them differently than what&rsquo;s above, open an issue.</p>
      </section>

      <section className="mt-12 border-t border-neutral-900 pt-6 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Sort the whole index by this score:{' '}
          <Link href="/programs?sort=opportunity" className="text-emerald-400 hover:underline">/programs?sort=opportunity</Link>
        </p>
        <a
          href="https://github.com/Varun2024/Bounty-index/blob/main/lib/opportunity.ts"
          className="mono text-xs text-neutral-500 hover:text-emerald-400 transition"
          target="_blank"
          rel="noreferrer"
        >
          source →
        </a>
      </section>
    </div>
  );
}
