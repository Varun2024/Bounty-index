import type { ProgramSnapshot } from '@/lib/db/queries';
import { programSignals } from '@/lib/snapshots';
import { relativeTime } from '@/lib/format';

interface ProgramSignalsStripProps {
  snapshots: ProgramSnapshot[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthYear(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function growthLabel(factor: number): string {
  return factor >= 2 ? `×${Math.round(factor)}` : `×${factor.toFixed(1)}`;
}

// A strip of derived facts computed from our own snapshot history: things the raw upstream
// list cannot tell a hunter, because they only exist across time. Each chip renders only when
// its signal is real, and the whole strip hides when nothing meaningful happened in the window.
export function ProgramSignalsStrip({ snapshots }: ProgramSignalsStripProps) {
  const sig = programSignals(snapshots);
  if (!sig.hasBaseline) return null;

  const chips: { tone: string; text: string }[] = [];

  if (sig.wentPaidAt) {
    chips.push({ tone: 'emerald', text: `went paid ${relativeTime(sig.wentPaidAt)}` });
  }
  if (sig.scopeGrowthFactor && sig.scopeGrowthFactor > 1.1) {
    chips.push({ tone: 'emerald', text: `scope ${growthLabel(sig.scopeGrowthFactor)} in ${sig.windowDays}d` });
  } else if (sig.scopeGrowthFactor && sig.scopeGrowthFactor < 0.9) {
    chips.push({ tone: 'amber', text: `scope ${growthLabel(sig.scopeGrowthFactor)} in ${sig.windowDays}d` });
  }
  if (sig.rewardRaises >= 1 && sig.firstRewardRaiseAt) {
    const times = sig.rewardRaises === 1 ? 'once' : sig.rewardRaises === 2 ? 'twice' : `${sig.rewardRaises}×`;
    chips.push({ tone: 'emerald', text: `reward raised ${times} since ${monthYear(sig.firstRewardRaiseAt)}` });
  }
  if (sig.changeEvents >= 3) {
    chips.push({ tone: 'neutral', text: `${sig.changeEvents} changes in ${sig.windowDays}d` });
  }

  if (chips.length === 0) return null;

  return (
    <section className="mt-6 reveal reveal-delay-1" aria-label="Derived signals from change history">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-400">signals</span>
        {chips.map((c) => (
          <span
            key={c.text}
            className={`mono text-[11px] px-2 py-1 rounded border ${
              c.tone === 'emerald'
                ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.06]'
                : c.tone === 'amber'
                  ? 'text-amber-300 border-amber-400/30 bg-amber-400/[0.06]'
                  : 'text-neutral-300 border-neutral-800 bg-neutral-900/50'
            }`}
          >
            {c.text}
          </span>
        ))}
        <span className="mono text-[10px] text-neutral-400">derived from our snapshot history</span>
      </div>
    </section>
  );
}
