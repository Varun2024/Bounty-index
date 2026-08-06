'use client';

import { useCallback, useSyncExternalStore } from 'react';

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

function write(ids: number[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  cachedSnapshot = null;
  window.dispatchEvent(new Event('watchlist:change'));
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

  const toggle = useCallback((id: number) => {
    const cur = readLocalStorage();
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }, []);

  const remove = useCallback((id: number) => {
    write(readLocalStorage().filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => write([]), []);

  return { ids, hydrated, toggle, remove, clear };
}
