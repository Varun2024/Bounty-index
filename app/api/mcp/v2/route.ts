import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import {
  registerCoreTools,
  summarize,
  json,
  normalizeAsset,
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
} from '@/lib/db/queries';

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
          'Sort by opportunity score to surface high-payout, broad-scope programs matching an asset type.',
        argsSchema: z.object({
          minReward: z.number().int().nonnegative().describe('Minimum max-bounty in USD, e.g. 10000.'),
          assetType: z.string().optional().describe('Optional, e.g. "wildcard", "api", "smart_contract".'),
          limit: z.number().int().positive().max(50).optional(),
        }),
      },
      ({ minReward, assetType, limit }) => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text:
                `Find high-paying programs with search_programs. Use:\n` +
                `  minReward: ${minReward}\n` +
                `  hasBounty: true\n` +
                (assetType ? `  assetType: ["${assetType}"]\n` : '') +
                `  sort: "opportunity"\n` +
                `  pageSize: ${limit ?? 10}\n\n` +
                `Return a ranked list: name · platform · max bounty · safe-harbor · bountyIndexUrl. ` +
                `Then call get_program on the top 3 and summarize their in-scope wildcards.`,
            },
          },
        ],
      }),
    );

    server.registerPrompt(
      'weekly-digest',
      {
        title: 'Weekly change digest',
        description:
          'Summarize scope / reward / safe-harbor changes over a rolling window, grouped by platform.',
        argsSchema: z.object({
          days: z.number().int().positive().max(30).optional().describe('Window in days. Default 7.'),
        }),
      },
      ({ days }) => {
        const d = days ?? 7;
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

export { handler as GET, handler as POST, handler as DELETE };
