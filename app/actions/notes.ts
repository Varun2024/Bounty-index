'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { userNotes } from '@/lib/db/schema';
import { NOTE_MAX_LEN, type NoteResult } from '@/lib/notes';

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

const EMPTY_NOTE: NoteResult = { content: '', updatedAt: null };

export async function getNote(programId: number): Promise<NoteResult> {
  const userId = await requireUserId();
  if (!userId) return EMPTY_NOTE;
  const [row] = await db
    .select({ content: userNotes.content, updatedAt: userNotes.updatedAt })
    .from(userNotes)
    .where(and(eq(userNotes.userId, userId), eq(userNotes.programId, programId)))
    .limit(1);
  if (!row) return EMPTY_NOTE;
  return { content: row.content, updatedAt: row.updatedAt.toISOString() };
}

export async function saveNote(programId: number, content: string): Promise<NoteResult> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  const trimmed = content.slice(0, NOTE_MAX_LEN);

  // Empty content = delete. Keeps the table lean and matches user intent.
  if (trimmed.trim().length === 0) {
    await db.delete(userNotes).where(and(eq(userNotes.userId, userId), eq(userNotes.programId, programId)));
    return EMPTY_NOTE;
  }

  const now = new Date();
  await db
    .insert(userNotes)
    .values({ userId, programId, content: trimmed, updatedAt: now })
    .onConflictDoUpdate({
      target: [userNotes.userId, userNotes.programId],
      set: { content: trimmed, updatedAt: now },
    });
  return { content: trimmed, updatedAt: now.toISOString() };
}
