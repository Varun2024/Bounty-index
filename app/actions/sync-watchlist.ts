'use server';

import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userWatchlist } from '@/lib/db/schema';
import { requireUserId } from './require-user';

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
