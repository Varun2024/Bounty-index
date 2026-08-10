'use server';

import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userSavedFilters } from '@/lib/db/schema';
import { requireUserId } from './require-user';

const SAVED_FILTERS_MAX = 20;
const SAVED_FILTER_NAME_MAX = 40;
const SAVED_FILTER_QUERY_MAX = 500;

export interface SavedFilter {
  id: number | string; // number for server rows, string uuid for localStorage-only entries
  name: string;
  query: string;
}

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
