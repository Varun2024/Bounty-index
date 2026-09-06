// Discord webhook helpers: URL validation, embed formatting, delivery.
// See docs/plans/PLAN_DISCORD.md for the full design.
//
// ponytail: pure functions. The only side effect is the `fetch()` in
// postDiffToWebhook. Everything else is deterministic and self-checkable.

import type { SnapshotDiff } from './snapshots';
import { formatBounty } from './format';

// Discord's official webhook hostnames. Reject anything else at write time —
// this is our whole SSRF surface. Non-negotiable.
const DISCORD_WEBHOOK_HOSTS = new Set(['discord.com', 'discordapp.com']);

export interface WebhookValidationResult {
  ok: boolean;
  error?: string;
  normalized?: string; // URL with any query string stripped (Discord accepts ?wait=)
}

export function validateDiscordWebhookUrl(input: string): WebhookValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'URL is empty' };
  if (trimmed.length > 400) return { ok: false, error: 'URL is too long' };

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }

  if (u.protocol !== 'https:') return { ok: false, error: 'Must be https' };
  if (!DISCORD_WEBHOOK_HOSTS.has(u.hostname)) {
    return { ok: false, error: 'Must be a discord.com webhook URL' };
  }
  // Discord webhook path: /api/webhooks/{id}/{token}
  if (!/^\/api\/webhooks\/\d+\/[\w-]+\/?$/.test(u.pathname)) {
    return { ok: false, error: 'Not a Discord webhook path' };
  }

  // Strip query + fragment; Discord's ?wait=true is opt-in and we don't need it.
  return { ok: true, normalized: `https://${u.hostname}${u.pathname.replace(/\/$/, '')}` };
}

// --- Embed formatting -------------------------------------------------------

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  author?: { name: string; icon_url?: string };
  fields?: DiscordEmbedField[];
  footer?: { text: string };
}

const COLOR_ADD = 0x22c55e;    // emerald: net-adds only
const COLOR_MIX = 0xf59e0b;    // amber:   has removals or reward drop
const COLOR_REWARD = 0x38bdf8; // sky:     reward-only change

function diffColor(diff: SnapshotDiff): number {
  if (diff.removed.length > 0) return COLOR_MIX;
  if (diff.rewardDelta && diff.rewardDelta.to != null && diff.rewardDelta.from != null && diff.rewardDelta.to < diff.rewardDelta.from) {
    return COLOR_MIX;
  }
  if (diff.added.length === 0 && diff.rewardDelta) return COLOR_REWARD;
  return COLOR_ADD;
}

interface FormatCtx {
  programName: string;
  programUrl: string;      // absolute URL to bounty.index detail page
  platformLabel: string;
  platformIcon?: string;   // absolute URL, optional
  currency: string;
  capturedAt: Date;
}

const MAX_IDENTIFIERS_SHOWN = 3;
const MAX_IDENTIFIER_CHARS = 60;

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function summaryLine(diff: SnapshotDiff, currency: string): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`+${diff.added.length} added`);
  if (diff.removed.length) parts.push(`−${diff.removed.length} removed`);
  if (diff.rewardDelta) {
    const from = diff.rewardDelta.from != null ? formatBounty(diff.rewardDelta.from, currency) : '—';
    const to = diff.rewardDelta.to != null ? formatBounty(diff.rewardDelta.to, currency) : '—';
    parts.push(`reward ${from} → ${to}`);
  }
  if (diff.safeHarborChanged) {
    parts.push(`safe-harbor ${diff.safeHarborChanged.from ?? '—'} → ${diff.safeHarborChanged.to ?? '—'}`);
  }
  return parts.join(' · ') || 'changes';
}

export function formatDiffEmbed(diff: SnapshotDiff, ctx: FormatCtx): DiscordEmbed {
  const fields: DiscordEmbedField[] = [];
  if (diff.added.length) {
    const sample = diff.added.slice(0, MAX_IDENTIFIERS_SHOWN).map((s) => `+ ${truncate(s, MAX_IDENTIFIER_CHARS)}`).join('\n');
    const more = diff.added.length > MAX_IDENTIFIERS_SHOWN ? `\n+ … ${diff.added.length - MAX_IDENTIFIERS_SHOWN} more` : '';
    fields.push({ name: 'Added', value: '```\n' + sample + more + '\n```' });
  }
  if (diff.removed.length) {
    const sample = diff.removed.slice(0, MAX_IDENTIFIERS_SHOWN).map((s) => `− ${truncate(s, MAX_IDENTIFIER_CHARS)}`).join('\n');
    const more = diff.removed.length > MAX_IDENTIFIERS_SHOWN ? `\n− … ${diff.removed.length - MAX_IDENTIFIERS_SHOWN} more` : '';
    fields.push({ name: 'Removed', value: '```\n' + sample + more + '\n```' });
  }
  return {
    title: ctx.programName,
    url: ctx.programUrl,
    description: summaryLine(diff, ctx.currency),
    color: diffColor(diff),
    timestamp: ctx.capturedAt.toISOString(),
    author: { name: ctx.platformLabel, icon_url: ctx.platformIcon },
    fields: fields.length ? fields : undefined,
    footer: { text: 'bountyindex.in' },
  };
}

// --- Delivery ---------------------------------------------------------------

export interface DeliveryResult {
  ok: boolean;
  status: number;
  broken: boolean;      // 401 or 404: mark subscription broken, stop trying
  retryable: boolean;   // 5xx or 429: try again on next cron
}

// POST an embed to a Discord webhook. Caller is responsible for rate-limiting;
// Discord permits ~30 req/min per URL.
export async function postDiffToWebhook(webhookUrl: string, embed: DiscordEmbed): Promise<DeliveryResult> {
  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
      // Discord webhooks respond fast; short timeout via AbortController would be nice
      // but the built-in fetch signal is enough for now.
    });
  } catch {
    // Network error → retryable next cron.
    return { ok: false, status: 0, broken: false, retryable: true };
  }
  const status = res.status;
  return {
    ok: res.ok,
    status,
    broken: status === 401 || status === 404,
    retryable: status === 429 || status >= 500,
  };
}

// --- Self-check -------------------------------------------------------------

if (require.main === module) {
  const cases: Array<[string, boolean]> = [
    ['https://discord.com/api/webhooks/123456789/abcDEF_xyz-123', true],
    ['https://discordapp.com/api/webhooks/1/tok', true],
    ['https://discord.com/api/webhooks/1/tok?wait=true', true],  // query stripped
    ['http://discord.com/api/webhooks/1/tok', false],             // wrong protocol
    ['https://evil.com/api/webhooks/1/tok', false],               // wrong host
    ['https://discord.com/webhooks/1/tok', false],                // wrong path
    ['https://discord.com/api/webhooks/abc/tok', false],          // non-numeric id
    ['not a url', false],
    ['', false],
  ];
  for (const [url, expected] of cases) {
    const r = validateDiscordWebhookUrl(url);
    const pass = r.ok === expected;
    // eslint-disable-next-line no-console
    console.log(`${pass ? 'ok ' : 'FAIL'} validate ${JSON.stringify(url)} → ${r.ok}${r.error ? ` (${r.error})` : ''}`);
    if (!pass) process.exit(1);
  }
  const embed = formatDiffEmbed(
    {
      added: ['api.new.shopify.com', '*.checkout-v2.shopify.com', 'mobile.shopify.com'],
      removed: ['community.shopify.com'],
      rewardDelta: { from: 50000, to: 75000 },
      safeHarborChanged: null,
    },
    {
      programName: 'Shopify',
      programUrl: 'https://bountyindex.in/programs/hackerone/shopify',
      platformLabel: 'HackerOne',
      currency: 'USD',
      capturedAt: new Date('2026-09-06T12:00:00Z'),
    },
  );
  const ok = embed.title === 'Shopify' && embed.color === COLOR_MIX && (embed.fields?.length ?? 0) === 2;
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'ok ' : 'FAIL'} embed format`, JSON.stringify(embed).slice(0, 200) + '...');
  if (!ok) process.exit(1);
  // eslint-disable-next-line no-console
  console.log('all discord cases passed');
}
