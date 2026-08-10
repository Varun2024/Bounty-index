import type { ProgramSnapshot, SnapshotPayloadShape } from '@/lib/db/queries';
import { diffSnapshots, isEmptyDiff } from '@/lib/snapshots';
import { formatBounty, relativeTime } from '@/lib/format';
import { SectionHeading } from '@/app/_ui/section-heading';
import { LifecycleChart } from './lifecycle-chart';

interface ProgramTimelineProps {
  snapshots: ProgramSnapshot[];
  currency: string;
}

export function ProgramTimeline({ snapshots, currency }: ProgramTimelineProps) {
  if (snapshots.length === 0) return null;

  // Walk chronologically; each snapshot's entry describes the diff from its predecessor.
  // The first snapshot is always "first indexed" — no diff.
  const entries = snapshots.map((snap, i) => ({
    capturedAt: snap.capturedAt,
    diff: i === 0 ? null : diffSnapshots(snapshots[i - 1].payload, snap.payload),
    isFirst: i === 0,
    payload: snap.payload,
  }));

  // Show newest first.
  const reversed = [...entries].reverse();

  const meaningfulChanges = reversed.filter((e) => e.isFirst || !isEmptyDiff(e.diff));

  return (
    <section className="mt-14 reveal reveal-delay-2">
      <SectionHeading title="History" className="mb-4">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {meaningfulChanges.length} event{meaningfulChanges.length === 1 ? '' : 's'}
        </span>
      </SectionHeading>
      {snapshots.length >= 2 && <LifecycleChart snapshots={snapshots} />}
      <ol className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
        {meaningfulChanges.map((e, i) => (
          <li key={e.capturedAt.toISOString()} className={i === meaningfulChanges.length - 1 ? '' : 'border-b border-neutral-900'}>
            <TimelineEntry entry={e} currency={currency} />
          </li>
        ))}
      </ol>
      {snapshots.length === 1 && (
        <p className="mono text-[11px] text-neutral-600 mt-3">
          <span className="text-neutral-700">{'// '}</span>
          only one snapshot on record — changes appear from the next ingest onward
        </p>
      )}
    </section>
  );
}

interface TimelineEntryProps {
  entry: {
    capturedAt: Date;
    diff: ReturnType<typeof diffSnapshots>;
    isFirst: boolean;
    payload: SnapshotPayloadShape;
  };
  currency: string;
}

function TimelineEntry({ entry, currency }: TimelineEntryProps) {
  const dateLabel = entry.capturedAt.toISOString().slice(0, 10);
  const rel = relativeTime(entry.capturedAt);

  if (entry.isFirst) {
    return (
      <div className="flex items-start gap-4 px-4 py-3">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums shrink-0 w-24 mt-0.5">
          {dateLabel}
        </span>
        <div className="flex-1">
          <p className="mono text-xs text-neutral-300">first indexed</p>
          <p className="mono text-[10px] text-neutral-600 mt-0.5">{rel} · {entry.payload.inScopeCount} in-scope assets</p>
        </div>
      </div>
    );
  }

  const diff = entry.diff;
  if (!diff) return null;

  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums shrink-0 w-24 mt-0.5">
        {dateLabel}
      </span>
      <div className="flex-1 space-y-1">
        {diff.rewardDelta !== null && (
          <p className="mono text-xs">
            <span className="text-neutral-500">reward: </span>
            <span className="text-neutral-500 line-through">{formatBounty(diff.rewardDelta.from, currency)}</span>
            <span className="text-neutral-700"> → </span>
            <span className="text-emerald-300">{formatBounty(diff.rewardDelta.to, currency)}</span>
          </p>
        )}
        {diff.safeHarborChanged && (
          <p className="mono text-xs">
            <span className="text-neutral-500">safe harbor: </span>
            <span className="text-neutral-500 line-through">{diff.safeHarborChanged.from ?? 'unknown'}</span>
            <span className="text-neutral-700"> → </span>
            <span className="text-emerald-300">{diff.safeHarborChanged.to ?? 'unknown'}</span>
          </p>
        )}
        {diff.added.length > 0 && (
          <p className="mono text-xs">
            <span className="text-emerald-400">+ added </span>
            <span className="text-neutral-500">{diff.added.length} scope{diff.added.length === 1 ? '' : 's'}</span>
            {diff.added.length <= 3 && (
              <span className="text-neutral-600"> · {diff.added.join(', ')}</span>
            )}
          </p>
        )}
        {diff.removed.length > 0 && (
          <p className="mono text-xs">
            <span className="text-red-400">− removed </span>
            <span className="text-neutral-500">{diff.removed.length} scope{diff.removed.length === 1 ? '' : 's'}</span>
            {diff.removed.length <= 3 && (
              <span className="text-neutral-600"> · {diff.removed.join(', ')}</span>
            )}
          </p>
        )}
        <p className="mono text-[10px] text-neutral-600">{rel}</p>
      </div>
    </div>
  );
}
