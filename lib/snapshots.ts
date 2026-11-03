import type { SnapshotPayloadShape } from './db/queries';

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  rewardDelta: { from: number | null; to: number | null } | null;
  safeHarborChanged: { from: string | null; to: string | null } | null;
  // A VDP flipping to paid (or back) is the highest-signal event upstream never flags for you.
  bountyTransition: { from: boolean; to: boolean } | null;
  // submission_state moving between open / paused / closed.
  statusChange: { from: string | null; to: string | null } | null;
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
  const bountyTransition = prev.offersBounty !== cur.offersBounty ? { from: prev.offersBounty, to: cur.offersBounty } : null;
  const statusChange = prev.submissionState !== cur.submissionState ? { from: prev.submissionState, to: cur.submissionState } : null;
  return { added, removed, rewardDelta, safeHarborChanged, bountyTransition, statusChange };
}

export function isEmptyDiff(d: SnapshotDiff | null): boolean {
  if (!d) return true;
  return (
    d.added.length === 0 &&
    d.removed.length === 0 &&
    d.rewardDelta === null &&
    d.safeHarborChanged === null &&
    d.bountyTransition === null &&
    d.statusChange === null
  );
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

// Derived, upstream-can't signals over a longer window (default 90 days). These are the
// headline facts a forker working from the raw list cannot reconstruct: that scope kept
// expanding, that the reward was raised more than once, that a VDP became paid. Each field
// stays null unless it's actually true, so the UI can render only what's real.
export interface ProgramSignals {
  windowDays: number;
  hasBaseline: boolean;
  scopeAdded: number;
  scopeRemoved: number;
  // current in-scope count ÷ in-scope count at the window's start. >1 means net growth.
  scopeGrowthFactor: number | null;
  rewardRaises: number;
  firstRewardRaiseAt: Date | null;
  wentPaidAt: Date | null;
  // Count of distinct snapshot events (any non-empty diff) inside the window. A volatility proxy.
  changeEvents: number;
}

export function programSignals(
  snapshots: { capturedAt: Date; payload: SnapshotPayloadShape }[],
  windowDays = 90,
  now: Date = new Date(),
): ProgramSignals {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const out: ProgramSignals = {
    windowDays,
    hasBaseline: false,
    scopeAdded: 0,
    scopeRemoved: 0,
    scopeGrowthFactor: null,
    rewardRaises: 0,
    firstRewardRaiseAt: null,
    wentPaidAt: null,
    changeEvents: 0,
  };
  if (snapshots.length < 2) return out;

  // Baseline = last snapshot at or before the window start. If every snapshot is inside the
  // window, the earliest one is the baseline.
  let baselineIdx = -1;
  for (let i = 0; i < snapshots.length; i++) {
    if (snapshots[i].capturedAt.getTime() <= cutoff) baselineIdx = i;
    else break;
  }
  const startIdx = baselineIdx === -1 ? 0 : baselineIdx;
  out.hasBaseline = baselineIdx !== -1 || snapshots.length > 1;

  for (let i = startIdx + 1; i < snapshots.length; i++) {
    const diff = diffSnapshots(snapshots[i - 1].payload, snapshots[i].payload);
    if (!diff || isEmptyDiff(diff)) continue;
    out.changeEvents += 1;
    out.scopeAdded += diff.added.length;
    out.scopeRemoved += diff.removed.length;
    if (diff.rewardDelta && diff.rewardDelta.to != null && (diff.rewardDelta.from ?? 0) < diff.rewardDelta.to) {
      out.rewardRaises += 1;
      if (!out.firstRewardRaiseAt) out.firstRewardRaiseAt = snapshots[i].capturedAt;
    }
    if (diff.bountyTransition && !diff.bountyTransition.from && diff.bountyTransition.to) {
      out.wentPaidAt = snapshots[i].capturedAt;
    }
  }

  const baseCount = snapshots[startIdx].payload.inScopeCount;
  const curCount = snapshots[snapshots.length - 1].payload.inScopeCount;
  if (baseCount > 0 && curCount !== baseCount) out.scopeGrowthFactor = curCount / baseCount;

  return out;
}

// Self-check — `npx tsx lib/snapshots.ts`. Dependency-free so it runs with the DB offline.
if (require.main === module) {
  const base = {
    name: 'x', url: 'x', handle: null, programType: 'vdp', offersBounty: false, offersSwag: false,
    managed: false, minBounty: null, maxBounty: null as number | null, currency: 'USD',
    submissionState: 'open' as string | null, safeHarbor: null as string | null, scopeCount: 0,
    inScopeCount: 0, scopeIdentifiers: [] as string[],
  };
  const day = 86_400_000;
  const now = new Date('2026-06-01T00:00:00Z');
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * day);
  const snaps = [
    { capturedAt: at(120), payload: { ...base, inScopeCount: 2, scopeIdentifiers: ['a', 'b'] } },
    { capturedAt: at(60), payload: { ...base, inScopeCount: 4, scopeIdentifiers: ['a', 'b', 'c', 'd'], offersBounty: true, programType: 'bounty', maxBounty: 5000 } },
    { capturedAt: at(20), payload: { ...base, inScopeCount: 6, scopeIdentifiers: ['a', 'b', 'c', 'd', 'e', 'f'], offersBounty: true, programType: 'bounty', maxBounty: 10000 } },
  ];
  const d = diffSnapshots(snaps[0].payload, snaps[1].payload)!;
  const sig = programSignals(snaps, 90, now);
  const checks: Array<[string, boolean]> = [
    ['bountyTransition detected', d.bountyTransition?.to === true],
    ['empty diff true for identical', isEmptyDiff(diffSnapshots(snaps[0].payload, snaps[0].payload))],
    ['wentPaid captured', sig.wentPaidAt !== null],
    ['reward raised twice in 90d window', sig.rewardRaises === 2],
    ['scope grew', (sig.scopeGrowthFactor ?? 0) > 1],
    ['change events counted', sig.changeEvents === 2],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'ok ' : 'FAIL'} ${name}`);
    if (!pass) ok = false;
  }
  if (!ok) process.exit(1);
  console.log('all snapshot cases passed');
}
