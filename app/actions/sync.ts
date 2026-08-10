'use server';

import { and, eq, desc } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { userWatchlist, userCompare, userSavedFilters } from '@/lib/db/schema';

const COMPARE_MAX = 4;
const SAVED_FILTERS_MAX = 20;
const SAVED_FILTER_NAME_MAX = 40;
const SAVED_FILTER_QUERY_MAX = 500;

export interface SavedFilter {
  id: number | string; // number for server rows, string uuid for localStorage-only entries
  name: string;
  query: string;
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// --- Watchlist ---

export async function getServerWatchlist(): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const rows = await db
    .select({ programId: userWatchlist.programId })
    .from(userWatchlist)
    .where(eq(userWatchlist.userId, userId))
    .orderBy(desc(userWatchlist.createdAt));
  return rows.map((r) => r.programId);
}

export async function addToServerWatchlist(programId: number): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  await db.insert(userWatchlist).values({ userId, programId }).onConflictDoNothing();
  return getServerWatchlist();
}

export async function removeFromServerWatchlist(programId: number): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  await db.delete(userWatchlist).where(and(eq(userWatchlist.userId, userId), eq(userWatchlist.programId, programId)));
  return getServerWatchlist();
}

export async function mergeServerWatchlist(localIds: number[]): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) return localIds;
  if (localIds.length > 0) {
    await db
      .insert(userWatchlist)
      .values(localIds.map((programId) => ({ userId, programId })))
      .onConflictDoNothing();
  }
  return getServerWatchlist();
}

// --- Compare ---

export async function getServerCompare(): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const rows = await db
    .select({ programId: userCompare.programId })
    .from(userCompare)
    .where(eq(userCompare.userId, userId))
    .orderBy(desc(userCompare.createdAt))
    .limit(COMPARE_MAX);
  return rows.map((r) => r.programId);
}

export async function addToServerCompare(programId: number): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  const current = await getServerCompare();
  if (current.includes(programId)) return current;
  if (current.length >= COMPARE_MAX) return current;
  await db.insert(userCompare).values({ userId, programId }).onConflictDoNothing();
  return getServerCompare();
}

export async function removeFromServerCompare(programId: number): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  await db.delete(userCompare).where(and(eq(userCompare.userId, userId), eq(userCompare.programId, programId)));
  return getServerCompare();
}

export async function clearServerCompare(): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  await db.delete(userCompare).where(eq(userCompare.userId, userId));
  return [];
}

export async function mergeServerCompare(localIds: number[]): Promise<number[]> {
  const userId = await requireUserId();
  if (!userId) return localIds;
  const capped = localIds.slice(0, COMPARE_MAX);
  if (capped.length > 0) {
    // Compare has a max — only insert what fits alongside existing rows.
    const existing = await getServerCompare();
    const room = COMPARE_MAX - existing.length;
    if (room > 0) {
      const toInsert = capped.filter((id) => !existing.includes(id)).slice(0, room);
      if (toInsert.length > 0) {
        await db
          .insert(userCompare)
          .values(toInsert.map((programId) => ({ userId, programId })))
          .onConflictDoNothing();
      }
    }
  }
  return getServerCompare();
}

// --- Saved filters ---

export async function getServerSavedFilters(): Promise<SavedFilter[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const rows = await db
    .select({ id: userSavedFilters.id, name: userSavedFilters.name, query: userSavedFilters.query })
    .from(userSavedFilters)
    .where(eq(userSavedFilters.userId, userId))
    .orderBy(desc(userSavedFilters.createdAt));
  return rows.map((r) => ({ id: r.id, name: r.name, query: r.query }));
}

function validateFilterInput(name: string, query: string): { name: string; query: string } {
  const trimmedName = name.trim();
  const trimmedQuery = query.replace(/^\?/, '').trim();
  if (!trimmedName) throw new Error('name required');
  if (trimmedName.length > SAVED_FILTER_NAME_MAX) throw new Error(`name too long (max ${SAVED_FILTER_NAME_MAX})`);
  if (trimmedQuery.length > SAVED_FILTER_QUERY_MAX) throw new Error(`query too long (max ${SAVED_FILTER_QUERY_MAX})`);
  return { name: trimmedName, query: trimmedQuery };
}

export async function addServerSavedFilter(name: string, query: string): Promise<SavedFilter[]> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  const clean = validateFilterInput(name, query);
  const current = await getServerSavedFilters();
  if (current.length >= SAVED_FILTERS_MAX) throw new Error(`limit reached (${SAVED_FILTERS_MAX})`);
  await db
    .insert(userSavedFilters)
    .values({ userId, name: clean.name, query: clean.query })
    .onConflictDoUpdate({
      target: [userSavedFilters.userId, userSavedFilters.name],
      set: { query: clean.query },
    });
  return getServerSavedFilters();
}

export async function removeServerSavedFilter(id: number): Promise<SavedFilter[]> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  await db.delete(userSavedFilters).where(and(eq(userSavedFilters.userId, userId), eq(userSavedFilters.id, id)));
  return getServerSavedFilters();
}

export async function mergeServerSavedFilters(local: SavedFilter[]): Promise<SavedFilter[]> {
  const userId = await requireUserId();
  if (!userId) return local;
  if (local.length === 0) return getServerSavedFilters();
  const existing = await getServerSavedFilters();
  const existingNames = new Set(existing.map((f) => f.name));
  const room = SAVED_FILTERS_MAX - existing.length;
  if (room <= 0) return existing;
  const toInsert: { userId: string; name: string; query: string }[] = [];
  for (const f of local) {
    if (toInsert.length >= room) break;
    let clean: { name: string; query: string };
    try {
      clean = validateFilterInput(f.name, f.query);
    } catch {
      continue; // skip malformed local entries
    }
    if (existingNames.has(clean.name)) continue;
    toInsert.push({ userId, ...clean });
    existingNames.add(clean.name);
  }
  if (toInsert.length > 0) {
    await db.insert(userSavedFilters).values(toInsert).onConflictDoNothing();
  }
  return getServerSavedFilters();
}

// A single call the client can make on sign-in to pull the freshly-known user id
// and push any localStorage state it was holding. Cheaper than three separate calls.
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
