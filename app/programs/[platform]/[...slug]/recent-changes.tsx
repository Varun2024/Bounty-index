import { diffSnapshots, isEmptyDiff } from '@/lib/snapshots';
import { relativeTime, shortenIdentifier } from '@/lib/format';
import { SectionHeading } from '@/app/_ui/section-heading';
import type { ProgramSnapshot } from '@/lib/db/queries';

interface RecentChangesProps {
  snapshots: ProgramSnapshot[];
  currency: string;
  limit?: number;
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

// Walks the snapshot array back-to-front and emits diff entries. `snapshots` is oldest→newest.
export function RecentChanges({ snapshots, currency, limit = 5 }: RecentChangesProps) {
  const events: { at: Date; added: string[]; removed: string[]; rewardDelta: { from: number | null; to: number | null } | null; safeHarborChanged: { from: string | null; to: string | null } | null }[] = [];
  for (let i = snapshots.length - 1; i > 0 && events.length < limit; i--) {
    const d = diffSnapshots(snapshots[i - 1].payload, snapshots[i].payload);
    if (!d || isEmptyDiff(d)) continue;
    events.push({
      at: snapshots[i].capturedAt,
      added: d.added,
      removed: d.removed,
      rewardDelta: d.rewardDelta,
      safeHarborChanged: d.safeHarborChanged,
    });
  }

  const sym = CURRENCY_SYMBOL[currency] ?? '$';

  return (
    <section className="mt-10">
      <SectionHeading title="Recent changes">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {events.length.toString().padStart(2, '0')}
        </span>
      </SectionHeading>
      {events.length === 0 ? (
        <p className="mono text-xs text-neutral-600 py-6">— no diffs detected in snapshot history yet —</p>
      ) : (
        <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
          {events.map((e, i) => (
            <li
              key={e.at.toISOString()}
              className={`px-4 py-3 flex flex-col gap-1 ${i === events.length - 1 ? '' : 'border-b border-neutral-900'}`}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 mono text-[11px] flex-wrap">
                  {e.added.length > 0 && (
                    <span className="text-emerald-300">+{e.added.length} scope</span>
                  )}
                  {e.removed.length > 0 && (
                    <span className="text-amber-300">−{e.removed.length} scope</span>
                  )}
                  {e.rewardDelta && (
                    <span className="text-neutral-300">
                      reward {formatMoney(e.rewardDelta.from, sym)} → {formatMoney(e.rewardDelta.to, sym)}
                    </span>
                  )}
                  {e.safeHarborChanged && (
                    <span className="text-neutral-300">
                      safe-harbor {e.safeHarborChanged.from ?? '—'} → {e.safeHarborChanged.to ?? '—'}
                    </span>
                  )}
                </div>
                <span className="mono text-[10px] uppercase tracking-widest text-neutral-600" title={e.at.toISOString()}>
                  {relativeTime(e.at)}
                </span>
              </div>
              {(e.added.length > 0 || e.removed.length > 0) && (
                <ul className="mono text-[11px] mt-1 space-y-0.5">
                  {e.added.slice(0, 3).map((id) => (
                    <li key={`a-${id}`} className="text-neutral-400"><span className="text-emerald-400">+</span> {shortenIdentifier(id, 80)}</li>
                  ))}
                  {e.removed.slice(0, 3).map((id) => (
                    <li key={`r-${id}`} className="text-neutral-400"><span className="text-amber-400">−</span> {shortenIdentifier(id, 80)}</li>
                  ))}
                  {(e.added.length + e.removed.length) > 6 && (
                    <li className="text-neutral-600">…and {e.added.length + e.removed.length - 6} more</li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatMoney(n: number | null, sym: string): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${sym}${Math.round(n / 1000)}K`;
  return `${sym}${n}`;
}
