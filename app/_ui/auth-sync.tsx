'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { _writeWatchlistLocal } from '@/lib/watchlist';
import { _writeCompareLocal } from '@/lib/compare';
import { _writeSavedFiltersLocal, type SavedFilter } from '@/lib/saved-filters';
import { syncOnSignIn } from '@/app/actions/sync';

const WATCHLIST_KEY = 'bounty-index:watchlist';
const COMPARE_KEY = 'bounty-index:compare';
const SAVED_FILTERS_KEY = 'bounty-index:saved-filters';

function readIds(key: string): number[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  } catch {
    return [];
  }
}

function readSavedFilters(): SavedFilter[] {
  try {
    const raw = window.localStorage.getItem(SAVED_FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is SavedFilter =>
        f != null &&
        typeof f === 'object' &&
        (typeof f.id === 'string' || typeof f.id === 'number') &&
        typeof f.name === 'string' &&
        typeof f.query === 'string',
    );
  } catch {
    return [];
  }
}

// Runs once per authenticated page load. Reads localStorage state, unions with server,
// writes the merged result back to localStorage. Idempotent — repeat sign-ins are a no-op.
export function AuthSync() {
  const { status } = useSession();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || syncedRef.current) return;
    syncedRef.current = true;
    const watchlistLocal = readIds(WATCHLIST_KEY);
    const compareLocal = readIds(COMPARE_KEY);
    const savedFiltersLocal = readSavedFilters();
    syncOnSignIn({ watchlistLocal, compareLocal, savedFiltersLocal })
      .then((res) => {
        _writeWatchlistLocal(res.watchlist);
        _writeCompareLocal(res.compare);
        _writeSavedFiltersLocal(res.savedFilters);
      })
      .catch(() => {
        syncedRef.current = false; // let it retry on next tick if it failed
      });
  }, [status]);

  return null;
}
