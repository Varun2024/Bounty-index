import Link from 'next/link';
import { opportunityScore, WEIGHTS } from '@/lib/opportunity';

interface OpportunityBreakdownProps {
  program: {
    maxBounty: number | null;
    offersBounty: boolean;
    lastUpdatedAt: Date | string | null;
  };
}

interface AxisRowProps {
  label: string;
  score: number;
  max: number;
  hint: string;
}

export function OpportunityBreakdown({ program }: OpportunityBreakdownProps) {
  const b = opportunityScore(program);
  const tone =
    b.total >= 75 ? 'text-emerald-300'
      : b.total >= 50 ? 'text-emerald-400/80'
        : b.total >= 25 ? 'text-neutral-200'
          : 'text-neutral-500';

  return (
    <section className="mt-10 border border-neutral-900 rounded-xl bg-neutral-950/50 overflow-hidden reveal reveal-delay-1">
      <div className="flex items-stretch">
        <div className="flex flex-col items-center justify-center px-6 py-5 border-r border-neutral-900 bg-neutral-950/60 min-w-[120px]">
          <div className={`mono text-5xl font-semibold tabular-nums ${tone}`}>{b.total}</div>
          <div className="mono text-[10px] uppercase tracking-widest text-neutral-500 mt-1">opp score</div>
        </div>
        <div className="flex-1 px-5 py-4 space-y-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">
              Opportunity breakdown
            </p>
            <Link
              href="/how-scored"
              className="mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-emerald-300 transition"
              title="How the score is computed"
            >
              formula →
            </Link>
          </div>
          <AxisRow label="payout" score={b.payout} max={WEIGHTS.payout} hint="log-scaled max bounty · $500 → $250k" />
          <AxisRow label="bounty" score={b.bounty} max={WEIGHTS.bounty} hint="pays cash vs VDP only" />
          <AxisRow label="freshness" score={b.freshness} max={WEIGHTS.freshness} hint="updated within 30d → full; 180d+ → zero" />
        </div>
      </div>
    </section>
  );
}

function AxisRow({ label, score, max, hint }: AxisRowProps) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const earned = Math.round(score);
  return (
    <div className="flex items-center gap-3" title={hint}>
      <div className="mono text-[10px] uppercase tracking-widest text-neutral-500 w-20 shrink-0">{label}</div>
      <div className="flex-1 h-1.5 rounded-full bg-neutral-900 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mono text-xs text-neutral-400 tabular-nums w-14 text-right shrink-0">
        <span className="text-neutral-100">{earned}</span>
        <span className="text-neutral-600">/{max}</span>
      </div>
    </div>
  );
}
