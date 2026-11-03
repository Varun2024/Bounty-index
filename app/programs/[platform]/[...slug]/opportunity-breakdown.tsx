import Link from 'next/link';
import { opportunityScore, WEIGHTS } from '@/lib/opportunity';
import { ProgramBadges } from '@/app/_ui/program-badges';

interface OpportunityBreakdownProps {
  program: {
    maxBounty: number | null;
    offersBounty: boolean;
    lastUpdatedAt: Date | string | null;
    firstSeenAt?: Date | string | null;
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
      <div className="flex flex-col md:flex-row md:items-stretch">
        <div className="flex md:flex-col items-center md:justify-center gap-3 md:gap-0 px-5 py-4 md:px-6 md:py-5 border-b md:border-b-0 md:border-r border-neutral-900 bg-neutral-950/60 md:min-w-[120px]">
          <div className={`mono text-4xl md:text-5xl font-semibold tabular-nums ${tone}`}>{b.total}</div>
          <div className="mono text-[10px] uppercase tracking-widest text-neutral-500 md:mt-1">hunt score</div>
        </div>
        <div className="flex-1 px-5 py-4 space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <ProgramBadges
              maxBounty={program.maxBounty}
              offersBounty={program.offersBounty}
              lastUpdatedAt={program.lastUpdatedAt}
              firstSeenAt={program.firstSeenAt}
              size="md"
            />
            <Link
              href="/how-scored"
              className="mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-emerald-300 transition"
              title="How the hunt score is computed"
            >
              formula →
            </Link>
          </div>
          <AxisRow label="payout" score={b.payout} max={WEIGHTS.payout} hint="log-scaled max bounty · $500 → $250k" />
          <AxisRow label="bounty" score={b.bounty} max={WEIGHTS.bounty} hint="pays cash vs VDP only" />
          <AxisRow label="freshness" score={b.freshness} max={WEIGHTS.freshness} hint="updated within 30d → full; 180d+ → zero" />
          <p className="mono text-[10px] text-neutral-600 pt-0.5">
            how we sort the index, not an estimate of what you&rsquo;ll earn
          </p>
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
