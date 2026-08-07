'use server';

import { and, eq, desc } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { userWatchlist, userCompare } from '@/lib/db/schema';

const COMPARE_MAX = 4;

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

// A single call the client can make on sign-in to pull the freshly-known user id
// and push any localStorage state it was holding. Cheaper than two separate calls.
export interface SyncPayload {
  watchlistLocal: number[];
  compareLocal: number[];
}

export interface SyncResult {
  userId: string | null;
  watchlist: number[];
  compare: number[];
}

export async function syncOnSignIn(payload: SyncPayload): Promise<SyncResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { userId: null, watchlist: payload.watchlistLocal, compare: payload.compareLocal };
  }
  const [watchlist, compare] = await Promise.all([
    mergeServerWatchlist(payload.watchlistLocal),
    mergeServerCompare(payload.compareLocal),
  ]);
  return { userId, watchlist, compare };
}
