'use server';

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userReports } from '@/lib/db/schema';
import { REPORT_COMMENT_MAX, type UserReport, type ProgramReportStats } from '@/lib/reports';
import { requireUserId } from './require-user';

const MIN_STATS_SAMPLE = 3;
const MAX_YEARS_BACK = 5;

function parseDateInput(raw: string, field: string): Date {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error(`${field}: expected YYYY-MM-DD`);
  const d = new Date(`${trimmed}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new Error(`${field}: invalid date`);
  const now = Date.now();
  const oldestMs = now - MAX_YEARS_BACK * 365 * 24 * 3600 * 1000;
  if (d.getTime() > now + 24 * 3600 * 1000) throw new Error(`${field}: cannot be in the future`);
  if (d.getTime() < oldestMs) throw new Error(`${field}: too far in the past`);
  return d;
}

export interface SubmitReportInput {
  programId: number;
  submittedAt: string; // YYYY-MM-DD
  firstResponseAt: string | null; // YYYY-MM-DD or null
  comment: string | null;
}

export async function submitReport(input: SubmitReportInput): Promise<UserReport> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  if (!Number.isInteger(input.programId) || input.programId <= 0) throw new Error('invalid program');

  const submittedAt = parseDateInput(input.submittedAt, 'submitted date');
  let firstResponseAt: Date | null = null;
  if (input.firstResponseAt) {
    firstResponseAt = parseDateInput(input.firstResponseAt, 'first-response date');
    if (firstResponseAt.getTime() < submittedAt.getTime()) {
      throw new Error('first-response date cannot be before submitted date');
    }
  }
  const comment = input.comment?.trim().slice(0, REPORT_COMMENT_MAX) || null;

  const now = new Date();
  await db
    .insert(userReports)
    .values({
      userId,
      programId: input.programId,
      submittedAt,
      firstResponseAt,
      comment,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userReports.userId, userReports.programId],
      set: { submittedAt, firstResponseAt, comment, updatedAt: now },
    });

  return {
    submittedAt: submittedAt.toISOString().slice(0, 10),
    firstResponseAt: firstResponseAt ? firstResponseAt.toISOString().slice(0, 10) : null,
    comment,
    updatedAt: now.toISOString(),
  };
}

export async function deleteReport(programId: number): Promise<void> {
  const userId = await requireUserId();
  if (!userId) throw new Error('not signed in');
  await db
    .delete(userReports)
    .where(and(eq(userReports.userId, userId), eq(userReports.programId, programId)));
}

export async function getUserReport(programId: number): Promise<UserReport | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  const [row] = await db
    .select({
      submittedAt: userReports.submittedAt,
      firstResponseAt: userReports.firstResponseAt,
      comment: userReports.comment,
      updatedAt: userReports.updatedAt,
    })
    .from(userReports)
    .where(and(eq(userReports.userId, userId), eq(userReports.programId, programId)))
    .limit(1);
  if (!row) return null;
  return {
    submittedAt: row.submittedAt.toISOString().slice(0, 10),
    firstResponseAt: row.firstResponseAt ? row.firstResponseAt.toISOString().slice(0, 10) : null,
    comment: row.comment,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Public aggregate. Median first-response in days is null when fewer than MIN_STATS_SAMPLE
// (3) rows have a first-response date — small-N medians are noise, not signal.
export async function getProgramReportStats(programId: number): Promise<ProgramReportStats> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      waiting: sql<number>`count(*) filter (where ${userReports.firstResponseAt} is null)::int`,
      answered: sql<number>`count(*) filter (where ${userReports.firstResponseAt} is not null)::int`,
      median: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from ${userReports.firstResponseAt} - ${userReports.submittedAt}) / 86400) filter (where ${userReports.firstResponseAt} is not null)`,
    })
    .from(userReports)
    .where(eq(userReports.programId, programId));

  const answered = row?.answered ?? 0;
  const median = row?.median ?? null;
  return {
    count: row?.count ?? 0,
    waitingCount: row?.waiting ?? 0,
    medianFirstResponseDays: answered >= MIN_STATS_SAMPLE && median !== null ? Math.round(median * 10) / 10 : null,
  };
}
