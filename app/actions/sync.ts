'use server';

// Sign-in bridge only. Per-domain actions live in sibling files:
//   sync-watchlist.ts       — user_watchlist CRUD + merge
//   sync-compare.ts         — user_compare CRUD + merge (capped)
//   sync-saved-filters.ts   — user_saved_filters CRUD + merge
//
// This module owns the one-round-trip payload the client sends on sign-in, so the three
// merges run in parallel and the client can write everything back to localStorage in one pass.

import { requireUserId } from './require-user';
import { mergeServerWatchlist } from './sync-watchlist';
import { mergeServerCompare } from './sync-compare';
import { mergeServerSavedFilters, type SavedFilter } from './sync-saved-filters';

export interface SyncPayload {
  watchlistLocal: number[];
  compareLocal: number[];
  savedFiltersLocal: SavedFilter[];
}

export interface SyncResult {
  userId: string | null;
  watchlist: number[];
  compare: number[];
  savedFilters: SavedFilter[];
}

export async function syncOnSignIn(payload: SyncPayload): Promise<SyncResult> {
  const userId = await requireUserId();
  if (!userId) {
    return {
      userId: null,
      watchlist: payload.watchlistLocal,
      compare: payload.compareLocal,
      savedFilters: payload.savedFiltersLocal,
    };
  }
  const [watchlist, compare, savedFilters] = await Promise.all([
    mergeServerWatchlist(payload.watchlistLocal),
    mergeServerCompare(payload.compareLocal),
    mergeServerSavedFilters(payload.savedFiltersLocal),
  ]);
  return { userId, watchlist, compare, savedFilters };
}
