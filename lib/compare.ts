'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
  addToServerCompare,
  removeFromServerCompare,
  clearServerCompare,
} from '@/app/actions/sync';

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

function writeLocal(ids: number[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  cachedSnapshot = null;
  window.dispatchEvent(new Event('compare:change'));
}

// Exported for the AuthSync bridge — should not be called from feature code.
export function _writeCompareLocal(ids: number[]) {
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
  window.addEventListener('compare:change', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('compare:change', handler);
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

export function useCompareSelection() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();
  const { data: session } = useSession();
  const isAuthed = !!session?.user;

  const toggle = useCallback(
    async (id: number) => {
      const cur = readLocalStorage();
      const isRemoving = cur.includes(id);
      const optimistic = isRemoving ? cur.filter((x) => x !== id) : [...cur, id].slice(0, MAX);
      writeLocal(optimistic);
      if (!isAuthed) return;
      try {
        const authoritative = isRemoving
          ? await removeFromServerCompare(id)
          : await addToServerCompare(id);
        writeLocal(authoritative);
      } catch {
        writeLocal(cur);
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
        const authoritative = await removeFromServerCompare(id);
        writeLocal(authoritative);
      } catch {
        writeLocal(cur);
      }
    },
    [isAuthed],
  );

  const clear = useCallback(async () => {
    writeLocal([]);
    if (!isAuthed) return;
    try {
      await clearServerCompare();
    } catch {
      /* keep the local clear even if the server call fails; user can re-clear */
    }
  }, [isAuthed]);

  return { ids, hydrated, toggle, remove, clear, max: MAX, isFull: ids.length >= MAX, isAuthed };
}
