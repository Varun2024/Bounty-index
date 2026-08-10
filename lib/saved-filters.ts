'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
  addServerSavedFilter,
  removeServerSavedFilter,
  type SavedFilter,
} from '@/app/actions/sync-saved-filters';

export type { SavedFilter };

const KEY = 'bounty-index:saved-filters';
const EMPTY: SavedFilter[] = Object.freeze([]) as unknown as SavedFilter[];

function readLocalStorage(): SavedFilter[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const filtered = parsed.filter(
      (f): f is SavedFilter =>
        f != null &&
        typeof f === 'object' &&
        (typeof f.id === 'string' || typeof f.id === 'number') &&
        typeof f.name === 'string' &&
        typeof f.query === 'string',
    );
    return filtered.length === 0 ? EMPTY : filtered;
  } catch {
    return EMPTY;
  }
}

function writeLocal(next: SavedFilter[]) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  cachedSnapshot = null;
  window.dispatchEvent(new Event('saved-filters:change'));
}

// Exported for the AuthSync bridge — should not be called from feature code.
export function _writeSavedFiltersLocal(next: SavedFilter[]) {
  writeLocal(next);
}

let cachedSnapshot: SavedFilter[] | null = null;

function getSnapshot(): SavedFilter[] {
  if (typeof window === 'undefined') return EMPTY;
  if (cachedSnapshot === null) cachedSnapshot = readLocalStorage();
  return cachedSnapshot;
}

function getServerSnapshot(): SavedFilter[] {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  const handler = () => {
    cachedSnapshot = null;
    cb();
  };
  window.addEventListener('saved-filters:change', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('saved-filters:change', handler);
    window.removeEventListener('storage', handler);
  };
}

const noopSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function genLocalId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSavedFilters() {
  const filters = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();
  const { data: session } = useSession();
  const isAuthed = !!session?.user;

  const add = useCallback(
    async (name: string, query: string) => {
      const trimmedName = name.trim();
      const trimmedQuery = query.replace(/^\?/, '').trim();
      if (!trimmedName) return;
      const cur = readLocalStorage();
      // Replace existing by name (case-insensitive) so the "save current" flow is idempotent.
      const withoutDupe = cur.filter((f) => f.name.toLowerCase() !== trimmedName.toLowerCase());
      const optimistic: SavedFilter = { id: genLocalId(), name: trimmedName, query: trimmedQuery };
      const next = [optimistic, ...withoutDupe];
      writeLocal(next);
      if (!isAuthed) return;
      try {
        const authoritative = await addServerSavedFilter(trimmedName, trimmedQuery);
        writeLocal(authoritative);
      } catch {
        writeLocal(cur); // rollback on server error
      }
    },
    [isAuthed],
  );

  const remove = useCallback(
    async (id: number | string) => {
      const cur = readLocalStorage();
      writeLocal(cur.filter((f) => f.id !== id));
      if (!isAuthed || typeof id !== 'number') return;
      try {
        const authoritative = await removeServerSavedFilter(id);
        writeLocal(authoritative);
      } catch {
        writeLocal(cur);
      }
    },
    [isAuthed],
  );

  return { filters, hydrated, add, remove, isAuthed };
}
