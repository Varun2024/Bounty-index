'use client';

import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'bounty-index:compare';
const MAX = 4;

function readLocalStorage(): number[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const filtered = parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)).slice(0, MAX);
    return filtered.length === 0 ? EMPTY : filtered;
  } catch {
    return EMPTY;
  }
}

function write(ids: number[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  cachedSnapshot = null;
  window.dispatchEvent(new Event('compare:change'));
}

// Stable empty ref for SSR + fallback — useSyncExternalStore requires snapshot identity to be stable across calls when nothing changed.
const EMPTY: number[] = Object.freeze([]) as unknown as number[];

// Client-side snapshot cache. Invalidated on change events + on write().
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
  window.addEventListener('compare:change', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('compare:change', handler);
    window.removeEventListener('storage', handler);
  };
}

// A never-firing subscribe means the value only reads on mount + on re-render triggered elsewhere.
// Server returns false, client returns true — that's the whole "am I past hydration" signal.
const noopSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function useCompareSelection() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();

  const toggle = useCallback((id: number) => {
    const cur = readLocalStorage();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, MAX);
    write(next);
  }, []);

  const remove = useCallback((id: number) => {
    write(readLocalStorage().filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => {
    write([]);
  }, []);

  return { ids, hydrated, toggle, remove, clear, max: MAX, isFull: ids.length >= MAX };
}
