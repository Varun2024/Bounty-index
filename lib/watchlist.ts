'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
  addToServerWatchlist,
  removeFromServerWatchlist,
} from '@/app/actions/sync';

const KEY = 'bounty-index:watchlist';

function readLocalStorage(): number[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const filtered = parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    return filtered.length === 0 ? EMPTY : filtered;
  } catch {
    return EMPTY;
  }
}

function writeLocal(ids: number[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  cachedSnapshot = null;
  window.dispatchEvent(new Event('watchlist:change'));
}

// Exported for the AuthSync bridge — should not be called from feature code.
export function _writeWatchlistLocal(ids: number[]) {
  writeLocal(ids);
}

const EMPTY: number[] = Object.freeze([]) as unknown as number[];
let cachedSnapshot: number[] | null = null;

function getSnapshot(): number[] {
  if (typeof window === 'undefined') return EMPTY;
  if (cachedSnapshot === null) cachedSnapshot = readLocalStorage();
  return cachedSnapshot;
}

function getServerSnapshot(): number[] {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  const handler = () => {
    cachedSnapshot = null;
    cb();
  };
  window.addEventListener('watchlist:change', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('watchlist:change', handler);
    window.removeEventListener('storage', handler);
  };
}

const noopSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function useWatchlist() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();
  const { data: session } = useSession();
  const isAuthed = !!session?.user;

  const toggle = useCallback(
    async (id: number) => {
      const cur = readLocalStorage();
      const isRemoving = cur.includes(id);
      const optimistic = isRemoving ? cur.filter((x) => x !== id) : [...cur, id];
      writeLocal(optimistic);
      if (!isAuthed) return;
      try {
        const authoritative = isRemoving
          ? await removeFromServerWatchlist(id)
          : await addToServerWatchlist(id);
        writeLocal(authoritative);
      } catch {
        writeLocal(cur); // rollback on server error
      }
    },
    [isAuthed],
  );

  const remove = useCallback(
    async (id: number) => {
      const cur = readLocalStorage();
      writeLocal(cur.filter((x) => x !== id));
      if (!isAuthed) return;
      try {
        const authoritative = await removeFromServerWatchlist(id);
        writeLocal(authoritative);
      } catch {
        writeLocal(cur);
      }
    },
    [isAuthed],
  );

  const clear = useCallback(() => writeLocal([]), []);

  return { ids, hydrated, toggle, remove, clear, isAuthed };
}
