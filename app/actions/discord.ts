'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { discordWebhooks, programs } from '@/lib/db/schema';
import { validateDiscordWebhookUrl } from '@/lib/discord';
import { requireUserId } from './require-user';

// Soft limit per user (hard limit at 100 enforced below).
const MAX_WEBHOOKS_PER_USER = 100;
const LABEL_MAX = 60;

export interface UserWebhookRow {
  id: number;
  programId: number;
  programName: string;
  programPlatform: string;
  programSlug: string;
  webhookUrl: string;
  webhookUrlHint: string; // masked for display
  label: string | null;
  lastDeliveredAt: string | null;
  brokenAt: string | null;
  createdAt: string;
}

function maskWebhook(url: string): string {
  // Show host + short tail of id, hide token entirely.
  // https://discord.com/api/webhooks/1234567890/tok... → discord.com/…/1234…
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 2] ?? '';
    return `${u.hostname}/…/${id.slice(0, 4)}…`;
  } catch {
    return 'discord webhook';
  }
}

export async function listMyWebhooks(): Promise<UserWebhookRow[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const rows = await db
    .select({
      id: discordWebhooks.id,
      programId: discordWebhooks.programId,
      programName: programs.name,
      programPlatform: programs.platform,
      programSlug: programs.slug,
      webhookUrl: discordWebhooks.webhookUrl,
      label: discordWebhooks.label,
      lastDeliveredAt: discordWebhooks.lastDeliveredAt,
      brokenAt: discordWebhooks.brokenAt,
      createdAt: discordWebhooks.createdAt,
    })
    .from(discordWebhooks)
    .innerJoin(programs, eq(programs.id, discordWebhooks.programId))
    .where(eq(discordWebhooks.userId, userId))
    .orderBy(discordWebhooks.createdAt);

  return rows.map((r) => ({
    id: r.id,
    programId: r.programId,
    programName: r.programName,
    programPlatform: r.programPlatform,
    programSlug: r.programSlug,
    webhookUrl: r.webhookUrl,
    webhookUrlHint: maskWebhook(r.webhookUrl),
    label: r.label,
    lastDeliveredAt: r.lastDeliveredAt?.toISOString() ?? null,
    brokenAt: r.brokenAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface AddWebhookInput {
  programId: number;
  webhookUrl: string;
  label?: string | null;
}

export async function addWebhook(input: AddWebhookInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'sign in first' };
  if (!Number.isInteger(input.programId) || input.programId <= 0) {
    return { ok: false, error: 'invalid program' };
  }

  const v = validateDiscordWebhookUrl(input.webhookUrl);
  if (!v.ok || !v.normalized) return { ok: false, error: v.error ?? 'invalid url' };
  const url = v.normalized;

  const label = input.label?.trim().slice(0, LABEL_MAX) || null;

  // Enforce hard cap on subscriptions per user.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(discordWebhooks)
    .where(eq(discordWebhooks.userId, userId));
  if (n >= MAX_WEBHOOKS_PER_USER) {
    return { ok: false, error: `limit reached (${MAX_WEBHOOKS_PER_USER})` };
  }

  // Program must exist.
  const [prog] = await db.select({ id: programs.id }).from(programs).where(eq(programs.id, input.programId)).limit(1);
  if (!prog) return { ok: false, error: 'program not found' };

  await db
    .insert(discordWebhooks)
    .values({ userId, programId: input.programId, webhookUrl: url, label })
    .onConflictDoUpdate({
      target: [discordWebhooks.userId, discordWebhooks.programId, discordWebhooks.webhookUrl],
      set: { label, brokenAt: null }, // re-saving clears the broken flag
    });

  revalidatePath('/settings/discord');
  return { ok: true };
}

export async function removeWebhook(id: number): Promise<void> {
  const userId = await requireUserId();
  if (!userId) throw new Error('sign in first');
  if (!Number.isInteger(id) || id <= 0) throw new Error('invalid id');
  await db.delete(discordWebhooks).where(and(eq(discordWebhooks.id, id), eq(discordWebhooks.userId, userId)));
  revalidatePath('/settings/discord');
}

export async function removeAllMyWebhooks(): Promise<void> {
  const userId = await requireUserId();
  if (!userId) throw new Error('sign in first');
  await db.delete(discordWebhooks).where(eq(discordWebhooks.userId, userId));
  revalidatePath('/settings/discord');
}

// Fire a sample embed at the webhook to prove wiring works. Used from the settings-page
// "test" button. Marks the row broken if Discord returns 401/404 so the UI reflects
// reality on the next refresh.
export async function testWebhook(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'sign in first' };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'invalid id' };

  const [row] = await db
    .select({
      id: discordWebhooks.id,
      webhookUrl: discordWebhooks.webhookUrl,
      programId: discordWebhooks.programId,
      programName: programs.name,
      programPlatform: programs.platform,
      programSlug: programs.slug,
      currency: programs.currency,
    })
    .from(discordWebhooks)
    .innerJoin(programs, eq(programs.id, discordWebhooks.programId))
    .where(and(eq(discordWebhooks.id, id), eq(discordWebhooks.userId, userId)))
    .limit(1);
  if (!row) return { ok: false, error: 'not found' };

  const { formatDiffEmbed, postDiffToWebhook } = await import('@/lib/discord');
  const { platformLabel } = await import('@/lib/format');
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bountyindex.in';

  const sampleDiff = {
    added: [
      `test-alert.${row.programSlug}.example`,
      `*.new-service.${row.programSlug}.example`,
    ],
    removed: [`legacy.${row.programSlug}.example`],
    rewardDelta: { from: 5000, to: 7500 },
    safeHarborChanged: null,
  };

  const embed = formatDiffEmbed(sampleDiff, {
    programName: `${row.programName} · test alert`,
    programUrl: `${SITE_URL}/programs/${encodeURIComponent(row.programPlatform)}/${row.programSlug
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
    platformLabel: platformLabel(row.programPlatform),
    currency: row.currency ?? 'USD',
    capturedAt: new Date(),
  });

  const res = await postDiffToWebhook(row.webhookUrl, embed);
  if (res.ok) return { ok: true };
  if (res.broken) {
    await db.update(discordWebhooks).set({ brokenAt: new Date() }).where(eq(discordWebhooks.id, id));
    revalidatePath('/settings/discord');
    return { ok: false, error: `Discord returned ${res.status} — webhook likely deleted. Row marked broken.` };
  }
  return { ok: false, error: `Discord returned ${res.status}` };
}
