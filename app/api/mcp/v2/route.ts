import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { ResourceTemplate, type AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import {
  registerCoreTools,
  withMcpLogging,
  summarize,
  json,
  normalizeAsset,
  programUrl,
  type ProgramRow,
  type ProgramSummary,
} from '../_shared';
import {
  stats,
  topPayouts,
  recentlyAdded,
  trendingNewPayouts,
  getProgramsByIds,
  findByDomain,
  realPayoutsReport,
  getProgramBySlug,
  getDisclosedReports,
} from '@/lib/db/queries';
import { db } from '@/lib/db/client';
import { discordWebhooks, programs } from '@/lib/db/schema';
import { validateDiscordWebhookUrl } from '@/lib/discord';
import { verifyMcpToken } from '@/lib/mcp-tokens';

// Write/action tools below require a per-account MCP token (Authorization: Bearer). Reads stay public.
const MAX_SUBS_PER_USER = 50;
const AUTH_HELP =
  'This action needs a bounty.index MCP token. Create one at https://bountyindex.in/settings/mcp and set it as the "Authorization: Bearer <token>" header in your MCP client config.';

// The authenticated user id, if withMcpAuth attached one (clientId / extra.userId). null = anonymous.
function userIdFrom(extra: unknown): string | null {
  const ai = (extra as { authInfo?: { clientId?: string; extra?: { userId?: string } } } | undefined)?.authInfo;
  return ai?.extra?.userId ?? ai?.clientId ?? null;
}

// Verify a Discord webhook is live before we persist it (and confirm the caller controls it).
// SSRF is already closed off by validateDiscordWebhookUrl (discord.com hosts only).
async function pingWebhook(url: string, name: string, platform: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: `bounty.index: subscribed to ${name} (${platform}). Scope, reward, and safe-harbor changes will post here.`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { ok: false, error: `Discord rejected the webhook (HTTP ${res.status}). Check the URL is a current webhook.` };
    }
    if (!res.ok && res.status !== 429) return { ok: false, error: `Webhook returned HTTP ${res.status}.` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the webhook (timeout or network error).' };
  }
}

// v2 adds leaderboard + discovery tools, batch asset lookup, and three prompts
// that bundle the common agent workflows. v1 remains at /api/mcp. Both share
// the same tool bodies via _shared.ts.

const handler = createMcpHandler(
  (server) => {
    registerCoreTools(server);

    server.registerTool(
      'stats',
      {
        title: 'Site-wide totals',
        description:
          'Total programs, paying programs, in-scope asset count, platform count, last ingest time. Call once at start of session for orientation.',
        inputSchema: z.object({}),
      },
      async () => {
        const s = await stats();
        return json(s ?? { error: 'unavailable' });
      },
    );

    server.registerTool(
      'top_payouts',
      {
        title: 'Highest max-bounty programs',
        description:
          'Top N programs by advertised max bounty. Cheaper than search_programs when you only want the leaderboard.',
        inputSchema: z.object({
          limit: z.number().int().positive().max(50).optional().describe('Default 10, max 50.'),
        }),
      },
      async ({ limit }) => {
        const rows = await topPayouts(Math.min(limit ?? 10, 50));
        return json({ count: rows.length, programs: rows.map((r) => summarize(r as ProgramRow)) });
      },
    );

    server.registerTool(
      'recently_added',
      {
        title: 'Programs added in the last N days',
        description: 'Programs first seen within a rolling window, newest first.',
        inputSchema: z.object({
          days: z.number().int().positive().max(90).optional().describe('Default 14, max 90.'),
          limit: z.number().int().positive().max(100).optional().describe('Default 20, max 100.'),
        }),
      },
      async ({ days, limit }) => {
        const rows = await recentlyAdded(Math.min(limit ?? 20, 100), Math.min(days ?? 14, 90));
        return json({
          windowDays: days ?? 14,
          count: rows.length,
          programs: rows.map((r) => summarize(r as ProgramRow)),
        });
      },
    );

    server.registerTool(
      'trending_programs',
      {
        title: 'Newly added paying programs with highest rewards',
        description:
          'Highest-paying programs first seen in the last N days. Use for "what new programs are worth looking at".',
        inputSchema: z.object({
          days: z.number().int().positive().max(90).optional().describe('Default 30, max 90.'),
          limit: z.number().int().positive().max(50).optional().describe('Default 10, max 50.'),
        }),
      },
      async ({ days, limit }) => {
        const rows = await trendingNewPayouts(Math.min(limit ?? 10, 50), Math.min(days ?? 30, 90));
        return json({
          windowDays: days ?? 30,
          count: rows.length,
          programs: rows.map((r) => summarize(r as ProgramRow)),
        });
      },
    );

    server.registerTool(
      'programs_by_ids',
      {
        title: 'Bulk fetch program summaries by numeric id',
        description:
          'Pass up to 100 numeric ids (from a prior search). Returns summaries in a single round-trip.',
        inputSchema: z.object({
          ids: z.array(z.number().int().positive()).min(1).max(100),
        }),
      },
      async ({ ids }) => {
        const rows = await getProgramsByIds(ids);
        return json({ requested: ids.length, found: rows.length, programs: rows.map((r) => summarize(r as ProgramRow)) });
      },
    );

    server.registerTool(
      'bulk_scope_lookup',
      {
        title: 'Reverse-lookup many assets at once',
        description:
          'Pass up to 50 URLs/domains. Returns per-asset matches. Agent-friendly for triaging a whole asset list in one call.',
        inputSchema: z.object({
          assets: z.array(z.string()).min(1).max(50),
        }),
      },
      async ({ assets }) => {
        const results = await Promise.all(
          assets.map(async (asset) => {
            const domain = normalizeAsset(asset);
            if (!domain) return { asset, error: 'invalid_asset' as const };
            const rows = await findByDomain(domain);
            const byProgram = new Map<number, { program: ProgramSummary; matches: string[] }>();
            for (const r of rows) {
              const existing = byProgram.get(r.program.id);
              if (existing) {
                if (!existing.matches.includes(r.scope.identifier)) existing.matches.push(r.scope.identifier);
              } else {
                byProgram.set(r.program.id, {
                  program: summarize(r.program as ProgramRow),
                  matches: [r.scope.identifier],
                });
              }
            }
            return { asset: domain, matchCount: byProgram.size, matches: [...byProgram.values()] };
          }),
        );
        return json({ count: results.length, results });
      },
    );

    server.registerTool(
      'payout_stats',
      {
        title: 'What programs actually pay (disclosed-report medians)',
        description:
          'Programs ranked by MEDIAN disclosed bounty in USD, with report count (reports) and the single highest disclosed payout (topUsd). This is the data behind the /payouts report and the one view the public program list cannot give you: what a program typically pays, versus the outlier at the top. Only programs with enough disclosed reports to be statistically meaningful are included. Disclosed reports are a self-selected sample, not all payouts. Use for "what does X actually pay" and typical-vs-top-payout angles.',
        inputSchema: z.object({
          platform: z.string().optional().describe('With `slug`, return stats for this ONE program instead of the ranking.'),
          slug: z.string().optional().describe('With `platform`, the program slug, e.g. "shopify".'),
          limit: z.number().int().positive().max(200).optional().describe('Ranking mode: default 50, max 200.'),
          minReports: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('Ranking mode: only programs with at least this many disclosed USD reports.'),
          sort: z
            .enum(['median', 'reports', 'spread'])
            .optional()
            .describe('Ranking mode: median (default, highest typical payout first), reports (most-disclosed first), or spread (biggest top-to-median multiple first: where the headline payout most overstates the typical one).'),
        }),
      },
      async ({ platform, slug, limit, minReports, sort }) => {
        // Single-program mode: disclosed-payout stats for one program, including the thin-sample tier
        // the ranking excludes (with an honest caveat), so an agent triaging one target gets its real
        // payout profile in one call.
        if (platform && slug) {
          const target = await getProgramBySlug(platform, slug);
          if (!target) return json({ error: 'not_found', platform, slug });
          const reports = await getDisclosedReports(target.program.id);
          const amts = reports
            .filter((r) => typeof r.bountyAmount === 'number' && r.bountyAmount > 0 && (r.currency == null || r.currency.toUpperCase() === 'USD'))
            .map((r) => r.bountyAmount as number)
            .sort((a, b) => a - b);
          const n = amts.length;
          const median = n === 0 ? null : n % 2 ? amts[(n - 1) / 2] : Math.round((amts[n / 2 - 1] + amts[n / 2]) / 2);
          return json({
            program: { name: target.program.name, platform, slug, bountyIndexUrl: programUrl(platform, slug) },
            medianUsd: median,
            topUsd: n ? amts[n - 1] : null,
            reports: n,
            note:
              n === 0
                ? 'No disclosed USD reports for this program.'
                : n < 8
                  ? `Only ${n} disclosed USD reports; treat as indicative, not a stable median.`
                  : 'Disclosed reports only (a self-selected sample), normalized to USD.',
          });
        }

        const report = await realPayoutsReport();
        // spread = how many times the biggest disclosed payout exceeds the median; both from our corpus, same currency.
        const spread = (r: { top: number; median: number }): number => (r.median > 0 ? r.top / r.median : 0);
        let rows = report.rows;
        if (minReports) rows = rows.filter((r) => r.n >= minReports);
        if (sort === 'reports') rows = [...rows].sort((a, b) => b.n - a.n || b.median - a.median);
        else if (sort === 'spread') rows = [...rows].sort((a, b) => spread(b) - spread(a) || b.median - a.median);
        // default 'median' is the query's native order (median desc).
        const top = rows.slice(0, Math.min(limit ?? 50, 200));
        return json({
          spanFrom: report.spanFrom,
          spanTo: report.spanTo,
          note: 'Medians and tops are from disclosed reports only (a self-selected sample), normalized to USD. The median is what a program typically pays; topUsd is the single biggest disclosed payout, which is usually an outlier.',
          count: top.length,
          programs: top.map((r) => ({
            name: r.name,
            platform: r.platform,
            slug: r.slug,
            medianUsd: r.median,
            topUsd: r.top,
            reports: r.n,
            bountyIndexUrl: programUrl(r.platform, r.slug),
          })),
        });
      },
    );

    // --- Write/action tools (require an MCP token via Authorization: Bearer). ---

    server.registerTool(
      'subscribe_program',
      {
        title: 'Subscribe a Discord webhook to a program (write — needs token)',
        description:
          "Attach a Discord webhook so you get an alert when this program's scope, reward, or safe-harbor changes. Requires an MCP token (Authorization: Bearer). Idempotent: re-subscribing the same webhook is a no-op. Sends one confirmation message to the webhook.",
        inputSchema: z.object({
          platform: z.string().describe('e.g. "hackerone", "bugcrowd".'),
          slug: z.string().describe('Program slug, e.g. "shopify".'),
          webhookUrl: z.string().describe('A discord.com webhook URL (https://discord.com/api/webhooks/...).'),
          label: z.string().max(80).optional().describe('Optional label for this subscription.'),
        }),
      },
      async ({ platform, slug, webhookUrl, label }, extra) => {
        const userId = userIdFrom(extra);
        if (!userId) return json({ error: 'authentication_required', message: AUTH_HELP });
        const v = validateDiscordWebhookUrl(webhookUrl);
        if (!v.ok || !v.normalized) return json({ error: 'invalid_webhook', message: v.error });
        const target = await getProgramBySlug(platform, slug);
        if (!target) return json({ error: 'not_found', platform, slug });
        const existing = await db
          .select({ id: discordWebhooks.id })
          .from(discordWebhooks)
          .where(eq(discordWebhooks.userId, userId));
        if (existing.length >= MAX_SUBS_PER_USER) {
          return json({ error: 'limit_reached', message: `You have ${existing.length} subscriptions (max ${MAX_SUBS_PER_USER}). Unsubscribe some first.` });
        }
        const ping = await pingWebhook(v.normalized, target.program.name, platform);
        if (!ping.ok) return json({ error: 'webhook_unreachable', message: ping.error });
        const inserted = await db
          .insert(discordWebhooks)
          .values({ userId, programId: target.program.id, webhookUrl: v.normalized, label: label?.slice(0, 80) ?? null })
          .onConflictDoNothing()
          .returning({ id: discordWebhooks.id });
        return json({
          ok: true,
          subscribed: { platform, slug, name: target.program.name },
          alreadyExisted: inserted.length === 0,
          bountyIndexUrl: programUrl(platform, slug),
        });
      },
    );

    server.registerTool(
      'unsubscribe_program',
      {
        title: 'Remove Discord alert subscriptions for a program (write — needs token)',
        description:
          'Remove your Discord webhook subscription(s) for a program. Omit webhookUrl to remove ALL of your subscriptions for that program; pass it to remove one. Requires an MCP token.',
        inputSchema: z.object({
          platform: z.string(),
          slug: z.string(),
          webhookUrl: z.string().optional().describe('Remove only this webhook. Omit to remove all of yours for the program.'),
        }),
      },
      async ({ platform, slug, webhookUrl }, extra) => {
        const userId = userIdFrom(extra);
        if (!userId) return json({ error: 'authentication_required', message: AUTH_HELP });
        const target = await getProgramBySlug(platform, slug);
        if (!target) return json({ error: 'not_found', platform, slug });
        const conds = [eq(discordWebhooks.userId, userId), eq(discordWebhooks.programId, target.program.id)];
        if (webhookUrl) {
          const v = validateDiscordWebhookUrl(webhookUrl);
          if (!v.ok || !v.normalized) return json({ error: 'invalid_webhook', message: v.error });
          conds.push(eq(discordWebhooks.webhookUrl, v.normalized));
        }
        const removed = await db.delete(discordWebhooks).where(and(...conds)).returning({ id: discordWebhooks.id });
        return json({ ok: true, removed: removed.length, platform, slug });
      },
    );

    server.registerTool(
      'list_my_subscriptions',
      {
        title: 'List your Discord alert subscriptions (needs token)',
        description: 'List the programs you have Discord alert subscriptions for. Requires an MCP token. Webhook URLs are never returned.',
        inputSchema: z.object({}),
      },
      async (_args, extra) => {
        const userId = userIdFrom(extra);
        if (!userId) return json({ error: 'authentication_required', message: AUTH_HELP });
        const rows = await db
          .select({
            platform: programs.platform,
            slug: programs.slug,
            name: programs.name,
            label: discordWebhooks.label,
            brokenAt: discordWebhooks.brokenAt,
            createdAt: discordWebhooks.createdAt,
          })
          .from(discordWebhooks)
          .innerJoin(programs, eq(programs.id, discordWebhooks.programId))
          .where(eq(discordWebhooks.userId, userId))
          .orderBy(desc(discordWebhooks.createdAt));
        return json({
          count: rows.length,
          subscriptions: rows.map((r) => ({
            platform: r.platform,
            slug: r.slug,
            name: r.name,
            label: r.label,
            broken: r.brokenAt != null,
            createdAt: r.createdAt,
            bountyIndexUrl: programUrl(r.platform, r.slug),
          })),
        });
      },
    );

    // --- Prompts: templated agent workflows. ---------------------------------

    server.registerPrompt(
      'triage-target',
      {
        title: 'Triage an asset against every public program',
        description:
          'Given a URL or domain, resolve which programs cover it, pull full scope for each, and summarize payout + safe-harbor.',
        argsSchema: z.object({
          asset: z.string().describe('URL or domain, e.g. "shop.example.com".'),
        }),
      },
      ({ asset }) => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text:
                `Use the bounty.index MCP tools to triage ${asset}.\n\n` +
                `1. Call scope_lookup({ asset: "${asset}" }).\n` +
                `2. For each match, call get_program({ platform, slug }) to see full in-scope + out-of-scope lists.\n` +
                `3. Produce a short table: program · platform · max bounty · safe-harbor · matched scope identifiers.\n` +
                `4. Flag any out-of-scope matches as DO-NOT-TEST and note why.`,
            },
          },
        ],
      }),
    );

    server.registerPrompt(
      'find-high-paying',
      {
        title: 'Shortlist high-paying programs by asset type',
        description:
          'Sort by the hunt score (sort: "opportunity") to surface high-payout, broad-scope programs matching an asset type.',
        argsSchema: z.object({
          // Prompt args are strings on the wire; coerce.
          minReward: z.string().describe('Minimum max-bounty in USD, e.g. "10000".'),
          assetType: z.string().optional().describe('Optional, e.g. "wildcard", "api", "smart_contract".'),
          limit: z.string().optional().describe('Max results. Default "10", max "50".'),
        }),
      },
      ({ minReward, assetType, limit }) => {
        const min = Math.max(0, parseInt(minReward, 10) || 0);
        const n = Math.min(50, Math.max(1, parseInt(limit ?? '10', 10) || 10));
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text:
                  `Find high-paying programs with search_programs. Use:\n` +
                  `  minReward: ${min}\n` +
                  `  hasBounty: true\n` +
                  (assetType ? `  assetType: ["${assetType}"]\n` : '') +
                  `  sort: "opportunity"\n` +
                  `  pageSize: ${n}\n\n` +
                  `Return a ranked list: name · platform · max bounty · safe-harbor · bountyIndexUrl. ` +
                  `Then call get_program on the top 3 and summarize their in-scope wildcards.`,
              },
            },
          ],
        };
      },
    );

    server.registerPrompt(
      'weekly-digest',
      {
        title: 'Weekly change digest',
        description:
          'Summarize scope / reward / safe-harbor changes over a rolling window, grouped by platform.',
        argsSchema: z.object({
          days: z.string().optional().describe('Window in days. Default "7", max "30".'),
        }),
      },
      ({ days }) => {
        const d = Math.min(30, Math.max(1, parseInt(days ?? '7', 10) || 7));
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text:
                  `Call whats_new({ hoursBack: ${d * 24}, limit: 200 }).\n\n` +
                  `Produce a digest with three sections:\n` +
                  `  1. Reward hikes (rewardDelta > 0), sorted by delta DESC.\n` +
                  `  2. New in-scope assets added (added[] non-empty), highlight wildcards.\n` +
                  `  3. Safe-harbor changes (safeHarborChanged true).\n\n` +
                  `Within each section group by platform. Keep it skimmable.`,
              },
            },
          ],
        };
      },
    );

    // --- Resources: pre-rendered data agents can bind to without a tool call. ---

    server.registerResource(
      'program',
      new ResourceTemplate('program://{platform}/{slug}', { list: undefined }),
      {
        title: 'A bug bounty program record',
        description:
          'Bind one program as a resource by platform + slug, e.g. program://hackerone/shopify. Returns headers + in-scope / out-of-scope, the same record get_program gives. (Single-segment slugs only.)',
        mimeType: 'application/json',
      },
      async (uri, variables) => {
        const platform = Array.isArray(variables.platform) ? variables.platform[0] : variables.platform;
        const slug = Array.isArray(variables.slug) ? variables.slug.join('/') : variables.slug;
        const result = await getProgramBySlug(String(platform), String(slug));
        const body = result
          ? {
              ...summarize(result.program as ProgramRow),
              scope: {
                inScope: result.scopes.filter((s) => s.inScope).map((s) => ({ identifier: s.identifier, assetType: s.assetType })),
                outOfScope: result.scopes.filter((s) => !s.inScope).map((s) => ({ identifier: s.identifier, assetType: s.assetType })),
              },
            }
          : { error: 'not_found', platform, slug };
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(body, null, 2) }] };
      },
    );

    server.registerResource(
      'stats-overview',
      'stats://overview',
      {
        title: 'bounty.index overview',
        description: 'Current site-wide totals (programs, paying programs, platforms, last ingest).',
        mimeType: 'application/json',
      },
      async (uri) => {
        const s = await stats();
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(s ?? { error: 'unavailable' }, null, 2),
            },
          ],
        };
      },
    );
  },
  {
    serverInfo: { name: 'bounty-index', version: '0.2.0' },
    maxSubscriptions: 0,
  },
);

// Resolve a Bearer MCP token to its user. required:false → anonymous reads still work; only the
// write tools check for a user. A valid token attaches the user id, which the write tools read.
async function verifyMcpBearer(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  const res = await verifyMcpToken(bearer);
  if (!res) return undefined;
  return { token: bearer as string, clientId: res.userId, scopes: ['mcp:write'], extra: { userId: res.userId } };
}

const authed = withMcpAuth(handler, verifyMcpBearer, { required: false });
const logged = withMcpLogging(authed, 'v2');

export { logged as GET, logged as POST, logged as DELETE };
