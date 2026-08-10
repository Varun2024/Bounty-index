'use server';

import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userCompare } from '@/lib/db/schema';
import { requireUserId } from './require-user';

const COMPARE_MAX = 4;

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
