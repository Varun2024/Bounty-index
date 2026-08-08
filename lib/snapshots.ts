import type { SnapshotPayloadShape } from './db/queries';

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  rewardDelta: { from: number | null; to: number | null } | null;
  safeHarborChanged: { from: string | null; to: string | null } | null;
}

// Diff two adjacent snapshots (previous → current). Returns null if either side is missing.
export function diffSnapshots(
  prev: SnapshotPayloadShape | null,
  cur: SnapshotPayloadShape | null,
): SnapshotDiff | null {
  if (!cur || !prev) return null;
  const prevIds = new Set(prev.scopeIdentifiers);
  const curIds = new Set(cur.scopeIdentifiers);
  const added = cur.scopeIdentifiers.filter((id) => !prevIds.has(id));
  const removed = prev.scopeIdentifiers.filter((id) => !curIds.has(id));
  const rewardDelta = prev.maxBounty !== cur.maxBounty ? { from: prev.maxBounty, to: cur.maxBounty } : null;
  const safeHarborChanged = prev.safeHarbor !== cur.safeHarbor ? { from: prev.safeHarbor, to: cur.safeHarbor } : null;
  return { added, removed, rewardDelta, safeHarborChanged };
}

export function isEmptyDiff(d: SnapshotDiff | null): boolean {
  if (!d) return true;
  return d.added.length === 0 && d.removed.length === 0 && d.rewardDelta === null && d.safeHarborChanged === null;
}

export interface ActivitySummary {
  addedCount: number;
  removedCount: number;
  windowDays: number;
  rewardChanged: boolean;
  hasBaseline: boolean;
}

// Rollup of everything that changed within the last `windowDays`. Walks consecutive snapshot
// pairs and sums added/removed identifiers; also flags any reward or safe-harbor change.
// Requires the snapshots array to be sorted ascending by capturedAt (which getProgramSnapshots
// already returns that way).
export function summarizeActivity(
  snapshots: { capturedAt: Date; payload: SnapshotPayloadShape }[],
  windowDays = 7,
): ActivitySummary {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const summary: ActivitySummary = {
    addedCount: 0,
    removedCount: 0,
    windowDays,
    rewardChanged: false,
    hasBaseline: false,
  };
  if (snapshots.length === 0) return summary;

  // Find the last snapshot at or before the window start — that's the baseline.
  let baselineIdx = -1;
  for (let i = 0; i < snapshots.length; i++) {
    if (snapshots[i].capturedAt.getTime() <= cutoff) baselineIdx = i;
    else break;
  }
  // If every snapshot is inside the window, use the earliest as baseline.
  const startIdx = baselineIdx === -1 ? 0 : baselineIdx;
  summary.hasBaseline = baselineIdx !== -1 || snapshots.length > 1;

  for (let i = startIdx + 1; i < snapshots.length; i++) {
    const diff = diffSnapshots(snapshots[i - 1].payload, snapshots[i].payload);
    if (!diff) continue;
    summary.addedCount += diff.added.length;
    summary.removedCount += diff.removed.length;
    if (diff.rewardDelta) summary.rewardChanged = true;
  }
  return summary;
}
