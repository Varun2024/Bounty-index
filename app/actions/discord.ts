'use server';

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { discordWebhooks, programs, userWatchlist } from '@/lib/db/schema';
import { validateDiscordWebhookUrl } from '@/lib/discord';
import { requireUserId } from './require-user';

// Soft limit per user (hard limit at 100 enforced below).
const MAX_WEBHOOKS_PER_USER = 100;
const LABEL_MAX = 60;
const TOP_PAYING_COUNT = 10;

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

// Fire a sample embed at a pasted URL *before* it's saved, so the user gets
// proof-of-life (and catches a bad URL) without first picking a program and
// committing a row. Auth-gated: same rule as save — bounty.index must never be
// usable as an anonymous relay to POST into an arbitrary Discord channel.
// ponytail: no per-user throttle. Auth ties every call to a GitHub account, and
// Discord itself 429s a hammered URL. Add a cooldown only if abuse shows up.
export async function testWebhookUrl(
  webhookUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'sign in first' };

  const v = validateDiscordWebhookUrl(webhookUrl);
  if (!v.ok || !v.normalized) return { ok: false, error: v.error ?? 'invalid url' };

  const { formatDiffEmbed, postDiffToWebhook } = await import('@/lib/discord');
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bountyindex.in';

  const embed = formatDiffEmbed(
    {
      added: ['api.example.com', '*.staging.example.com'],
      removed: [],
      rewardDelta: { from: 5000, to: 10000 },
      safeHarborChanged: null,
    },
    {
      programName: 'bounty.index · test alert',
      programUrl: `${SITE_URL}/settings/discord`,
      platformLabel: 'bounty.index',
      currency: 'USD',
      capturedAt: new Date(),
    },
  );

  const res = await postDiffToWebhook(v.normalized, embed);
  if (res.ok) return { ok: true };
  if (res.broken) {
    return { ok: false, error: `Discord returned ${res.status} — check the URL is right and the webhook still exists.` };
  }
  return { ok: false, error: `Discord returned ${res.status}` };
}

// One-click bulk subscribe: point a pasted URL at a whole set of programs at once
// (the user's watchlist, or the current top payers) instead of hand-picking one
// at a time. Fills remaining slots up to the cap; dedupes against existing subs.
export type BatchSource = 'watchlist' | 'top-paying';

export async function addWebhooksBatch(input: {
  webhookUrl: string;
  source: BatchSource;
  label?: string | null;
}): Promise<{ ok: true; added: number; skipped: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'sign in first' };

  const v = validateDiscordWebhookUrl(input.webhookUrl);
  if (!v.ok || !v.normalized) return { ok: false, error: v.error ?? 'invalid url' };
  const url = v.normalized;
  const label = input.label?.trim().slice(0, LABEL_MAX) || null;

  let programIds: number[];
  if (input.source === 'watchlist') {
    const rows = await db
      .select({ id: userWatchlist.programId })
      .from(userWatchlist)
      .where(eq(userWatchlist.userId, userId));
    programIds = rows.map((r) => r.id);
    if (programIds.length === 0) return { ok: false, error: 'your watchlist is empty' };
  } else if (input.source === 'top-paying') {
    const rows = await db
      .select({ id: programs.id })
      .from(programs)
      .where(isNotNull(programs.maxBounty))
      .orderBy(desc(programs.maxBounty))
      .limit(TOP_PAYING_COUNT);
    programIds = rows.map((r) => r.id);
    if (programIds.length === 0) return { ok: false, error: 'no paying programs found' };
  } else {
    return { ok: false, error: 'unknown source' };
  }

  // Fill only the remaining slots under the hard cap.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(discordWebhooks)
    .where(eq(discordWebhooks.userId, userId));
  const slots = MAX_WEBHOOKS_PER_USER - n;
  if (slots <= 0) return { ok: false, error: `limit reached (${MAX_WEBHOOKS_PER_USER})` };

  const take = programIds.slice(0, slots);
  const skipped = programIds.length - take.length;
  if (take.length === 0) return { ok: false, error: 'nothing to add' };

  await db
    .insert(discordWebhooks)
    .values(take.map((programId) => ({ userId, programId, webhookUrl: url, label })))
    .onConflictDoUpdate({
      target: [discordWebhooks.userId, discordWebhooks.programId, discordWebhooks.webhookUrl],
      set: { label, brokenAt: null },
    });

  revalidatePath('/settings/discord');
  return { ok: true, added: take.length, skipped };
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
