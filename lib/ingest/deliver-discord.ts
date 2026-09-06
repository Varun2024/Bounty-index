// Post Discord webhook alerts for any snapshots written during the current ingest run.
//
// Called at the tail of the cron. Idempotent: uses `last_delivered_at` to skip webhooks
// that already got this snapshot's diff. Marks 401/404 as `broken_at` (no retry).
// Retryable failures (5xx, 429, network) leave the row untouched — next cron picks up.
//
// ponytail: naive per-URL sleep instead of a queue. 30 req/min per webhook is the
// Discord cap; a 50ms gap between consecutive POSTs to the same URL keeps us safe
// even if a single user watches 50 programs that all change on the same day.

import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { diffSnapshots, isEmptyDiff } from '../snapshots';
import type { SnapshotPayloadShape } from '../db/types';
import { formatDiffEmbed, postDiffToWebhook } from '../discord';
import { platformLabel } from '../format';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bountyindex.in';
const PER_URL_SPACING_MS = 50;

interface DiffJob {
  programId: number;
  capturedAt: Date;
  diff: NonNullable<ReturnType<typeof diffSnapshots>>;
  program: typeof schema.programs.$inferSelect;
}

export interface DeliveryReport {
  jobs: number;
  webhooksPosted: number;
  ok: number;
  broken: number;
  retryable: number;
}

export async function deliverDiscordAlerts(sinceTime: Date): Promise<DeliveryReport> {
  const report: DeliveryReport = { jobs: 0, webhooksPosted: 0, ok: 0, broken: 0, retryable: 0 };

  // 1. Snapshots written in this run.
  const freshSnaps = await db
    .select({ programId: schema.programSnapshots.programId, capturedAt: schema.programSnapshots.capturedAt })
    .from(schema.programSnapshots)
    .where(gt(schema.programSnapshots.capturedAt, sinceTime));
  if (freshSnaps.length === 0) return report;

  // Latest fresh snapshot per program (a program may have >1 in weird retry cases).
  const latestPerProgram = new Map<number, Date>();
  for (const s of freshSnaps) {
    const prev = latestPerProgram.get(s.programId);
    if (!prev || s.capturedAt > prev) latestPerProgram.set(s.programId, s.capturedAt);
  }
  const programIds = [...latestPerProgram.keys()];

  // 2. Are there any active webhooks for any of these programs? Short-circuit if no.
  const activeSubs = await db
    .select({ programId: schema.discordWebhooks.programId })
    .from(schema.discordWebhooks)
    .where(and(inArray(schema.discordWebhooks.programId, programIds), isNull(schema.discordWebhooks.brokenAt)));
  if (activeSubs.length === 0) return report;
  const subscribedPrograms = new Set(activeSubs.map((s) => s.programId));
  const targetPrograms = programIds.filter((id) => subscribedPrograms.has(id));

  // 3. For each subscribed program, compute the diff (need latest + previous snapshot).
  const programs = await db.select().from(schema.programs).where(inArray(schema.programs.id, targetPrograms));
  const programById = new Map(programs.map((p) => [p.id, p]));

  const jobs: DiffJob[] = [];
  for (const programId of targetPrograms) {
    const capturedAt = latestPerProgram.get(programId)!;
    const pair = await db
      .select({ capturedAt: schema.programSnapshots.capturedAt, payload: schema.programSnapshots.payload })
      .from(schema.programSnapshots)
      .where(eq(schema.programSnapshots.programId, programId))
      .orderBy(desc(schema.programSnapshots.capturedAt))
      .limit(2);
    if (pair.length < 2) continue; // first-ever snapshot — no diff to send
    const diff = diffSnapshots(pair[1].payload as SnapshotPayloadShape, pair[0].payload as SnapshotPayloadShape);
    if (!diff || isEmptyDiff(diff)) continue;
    const program = programById.get(programId);
    if (!program) continue;
    jobs.push({ programId, capturedAt, diff, program });
  }
  report.jobs = jobs.length;
  if (jobs.length === 0) return report;

  // 4. Load all active webhook subscriptions for those programs.
  const subs = await db
    .select()
    .from(schema.discordWebhooks)
    .where(and(inArray(schema.discordWebhooks.programId, jobs.map((j) => j.programId)), isNull(schema.discordWebhooks.brokenAt)));

  // Group subs by URL so we can pace POSTs to the same webhook.
  const subsByUrl = new Map<string, typeof subs>();
  for (const s of subs) {
    const list = subsByUrl.get(s.webhookUrl) ?? [];
    list.push(s);
    subsByUrl.set(s.webhookUrl, list);
  }

  // 5. Deliver. Iterate per-URL so we can sleep between POSTs to the same webhook.
  for (const [url, urlSubs] of subsByUrl) {
    for (const sub of urlSubs) {
      const job = jobs.find((j) => j.programId === sub.programId);
      if (!job) continue;
      // Idempotency: skip if we've already delivered this diff.
      if (sub.lastDeliveredAt && sub.lastDeliveredAt >= job.capturedAt) continue;

      const embed = formatDiffEmbed(job.diff, {
        programName: job.program.name,
        programUrl: `${SITE_URL}/programs/${encodeURIComponent(job.program.platform)}/${job.program.slug
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
        platformLabel: platformLabel(job.program.platform),
        currency: job.program.currency ?? 'USD',
        capturedAt: job.capturedAt,
      });

      const res = await postDiffToWebhook(url, embed);
      report.webhooksPosted++;
      if (res.ok) {
        report.ok++;
        await db
          .update(schema.discordWebhooks)
          .set({ lastDeliveredAt: job.capturedAt })
          .where(eq(schema.discordWebhooks.id, sub.id));
      } else if (res.broken) {
        report.broken++;
        await db
          .update(schema.discordWebhooks)
          .set({ brokenAt: new Date() })
          .where(eq(schema.discordWebhooks.id, sub.id));
      } else if (res.retryable) {
        report.retryable++;
        // Leave row untouched — next cron will retry.
      }
      await new Promise((r) => setTimeout(r, PER_URL_SPACING_MS));
    }
  }

  return report;
}
