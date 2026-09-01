import type { SnapshotDiff } from '../snapshots';
import type { programs } from './schema';

// Filters accepted by listPrograms + its fallback.
export interface ProgramFilters {
  q?: string;
  platform?: string[];
  assetType?: string[];
  programType?: string; // bounty | vdp | all
  minReward?: number;
  hasBounty?: boolean;
  safeHarbor?: boolean; // true = only programs with confirmed safe harbor (full or partial)
  sort?: 'newest' | 'reward' | 'name';
  page?: number;
  pageSize?: number;
}

// Shape of the payload we write in lib/ingest/bounty-targets.ts::buildSnapshotPayload.
// Defined as a stand-alone interface (not derived from an ingest export) so this file stays
// free of ingest coupling.
export interface SnapshotPayloadShape {
  name: string;
  url: string;
  handle: string | null;
  programType: string;
  offersBounty: boolean;
  offersSwag: boolean;
  managed: boolean;
  minBounty: number | null;
  maxBounty: number | null;
  currency: string;
  submissionState: string | null;
  safeHarbor: string | null;
  scopeCount: number;
  inScopeCount: number;
  scopeIdentifiers: string[];
}

// Full snapshot history for a single program, oldest → newest.
export interface ProgramSnapshot {
  capturedAt: Date;
  payload: SnapshotPayloadShape;
}

// Watchlist entry: program + its two most recent snapshot payloads for diff computation.
export interface WatchlistEntry {
  program: typeof programs.$inferSelect;
  latest: SnapshotPayloadShape | null;
  previous: SnapshotPayloadShape | null;
  latestAt: Date | null;
}

// One entry per snapshot diff (predecessor → current) where cur.capturedAt is inside the window.
export interface RecentChange {
  program: typeof programs.$inferSelect;
  capturedAt: Date;
  diff: SnapshotDiff;
}

// Similar-program result, ranked by count of shared in-scope identifiers.
export interface SimilarProgram {
  program: typeof programs.$inferSelect;
  overlap: number;
}
