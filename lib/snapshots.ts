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
