'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { _writeWatchlistLocal } from '@/lib/watchlist';
import { _writeCompareLocal } from '@/lib/compare';
import { syncOnSignIn } from '@/app/actions/sync';

const WATCHLIST_KEY = 'bounty-index:watchlist';
const COMPARE_KEY = 'bounty-index:compare';

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
    syncOnSignIn({ watchlistLocal, compareLocal })
      .then((res) => {
        _writeWatchlistLocal(res.watchlist);
        _writeCompareLocal(res.compare);
      })
      .catch(() => {
        syncedRef.current = false; // let it retry on next tick if it failed
      });
  }, [status]);

  return null;
}
