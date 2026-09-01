import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import {
  listPrograms,
  getProgramBySlug,
  findByDomain,
  getRecentChanges,
  getSimilarPrograms,
  getProgramSnapshots,
  listPlatformsWithCounts,
} from '@/lib/db/queries';

// v1 public read-only MCP. Reuses the same fallback-wrapped query functions the web UI uses,
// so this endpoint stays live through Neon quota outages exactly like /programs does.
// Stateless Streamable HTTP; no session store, no KV. Rate-limited by middleware.ts.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';

function json(text: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(text, null, 2) }] };
}

function programUrl(platform: string, slug: string): string {
  const encPlatform = encodeURIComponent(platform);
  const encSlug = slug.split('/').map(encodeURIComponent).join('/');
  return `${SITE_URL}/programs/${encPlatform}/${encSlug}`;
}

interface ProgramSummary {
  id: number;
  platform: string;
  slug: string;
  name: string;
  programType: string;
  offersBounty: boolean;
  minBounty: number | null;
  maxBounty: number | null;
  currency: string | null;
  safeHarbor: string | null;
  url: string;
  bountyIndexUrl: string;
}

interface ProgramRow {
  id: number;
  platform: string;
  slug: string;
  name: string;
  programType: string;
  offersBounty: boolean;
  minBounty: number | null;
  maxBounty: number | null;
  currency: string | null;
  safeHarbor: string | null;
  url: string;
  raw?: unknown;
}

function summarize(p: ProgramRow): ProgramSummary {
  return {
    id: p.id,
    platform: p.platform,
    slug: p.slug,
    name: p.name,
    programType: p.programType,
    offersBounty: p.offersBounty,
    minBounty: p.minBounty,
    maxBounty: p.maxBounty,
    currency: p.currency,
    safeHarbor: p.safeHarbor,
    url: p.url,
    bountyIndexUrl: programUrl(p.platform, p.slug),
  };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'search_programs',
      {
        title: 'Search bug bounty programs',
        description:
          'Search programs by keyword, platform, program type, asset type, minimum reward, or safe-harbor. Returns program summaries plus their bountyindex.in URLs. Use this first when the user names a company or asks "what programs pay >$X".',
        inputSchema: z.object({
          query: z.string().optional().describe('Free-text search across program name, handle, and in-scope identifiers.'),
          platform: z.array(z.string()).optional().describe('e.g. ["hackerone","bugcrowd"]. Omit for all platforms.'),
          programType: z.enum(['bounty', 'vdp', 'all']).optional().describe('bounty = paid, vdp = disclosure-only, all = both.'),
          assetType: z.array(z.string()).optional().describe('e.g. ["url","wildcard","api","android","ios","smart_contract"]'),
          minReward: z.number().int().nonnegative().optional().describe('Minimum max-bounty in USD.'),
          hasBounty: z.boolean().optional().describe('Restrict to programs that offer paid bounties.'),
          safeHarbor: z.boolean().optional().describe('Restrict to programs with confirmed safe-harbor.'),
          sort: z.enum(['newest', 'reward', 'name']).optional(),
          page: z.number().int().positive().optional(),
          pageSize: z.number().int().positive().max(100).optional().describe('Default 25, max 100.'),
        }),
      },
      async (args) => {
        const { rows, total, page, pageSize } = await listPrograms({
          q: args.query,
          platform: args.platform,
          programType: args.programType,
          assetType: args.assetType,
          minReward: args.minReward,
          hasBounty: args.hasBounty,
          safeHarbor: args.safeHarbor,
          sort: args.sort,
          page: args.page,
          pageSize: Math.min(args.pageSize ?? 25, 100),
        });
        return json({
          total,
          page,
          pageSize,
          results: rows.map(summarize),
        });
      },
    );

    server.registerTool(
      'get_program',
      {
        title: 'Get one program with scope',
        description:
          'Fetch a full program record (headers + in-scope + out-of-scope). Use after search_programs when you have a platform + slug.',
        inputSchema: z.object({
          platform: z.string().describe('e.g. "hackerone", "bugcrowd", "immunefi"'),
          slug: z.string().describe('Program slug on that platform, e.g. "shopify".'),
          include_raw: z.boolean().optional().describe('If true, include the upstream source payload. Default false.'),
        }),
      },
      async ({ platform, slug, include_raw }) => {
        const result = await getProgramBySlug(platform, slug);
        if (!result) return json({ error: 'not_found', platform, slug });
        const { program, scopes } = result;
        const summary = summarize(program as ProgramRow);
        const payload: Record<string, unknown> = {
          ...summary,
          submissionState: program.submissionState,
          managed: program.managed,
          offersSwag: program.offersSwag,
          handle: program.handle,
          firstSeenAt: program.firstSeenAt,
          lastUpdatedAt: program.lastUpdatedAt,
          scope: {
            inScope: scopes.filter((s) => s.inScope).map(({ id, identifier, assetType, eligibleForBounty, severity, instruction }) => ({
              id, identifier, assetType, eligibleForBounty, severity, instruction,
            })),
            outOfScope: scopes.filter((s) => !s.inScope).map(({ id, identifier, assetType, instruction }) => ({
              id, identifier, assetType, instruction,
            })),
          },
        };
        if (include_raw) payload.raw = program.raw;
        return json(payload);
      },
    );

    server.registerTool(
      'list_scope',
      {
        title: 'List a program\'s scope entries',
        description: 'Returns just the scope rows for a program. Cheaper than get_program when you only need scope.',
        inputSchema: z.object({
          platform: z.string(),
          slug: z.string(),
          inScope: z.boolean().optional().describe('true = in-scope only, false = out-of-scope only, omit = both.'),
          assetType: z.string().optional().describe('Filter to one asset type, e.g. "wildcard".'),
        }),
      },
      async ({ platform, slug, inScope, assetType }) => {
        const result = await getProgramBySlug(platform, slug);
        if (!result) return json({ error: 'not_found', platform, slug });
        let scopes = result.scopes;
        if (inScope !== undefined) scopes = scopes.filter((s) => s.inScope === inScope);
        if (assetType) scopes = scopes.filter((s) => s.assetType === assetType);
        return json({
          platform,
          slug,
          count: scopes.length,
          scope: scopes.map(({ id, identifier, assetType, inScope, eligibleForBounty, severity, instruction }) => ({
            id, identifier, assetType, inScope, eligibleForBounty, severity, instruction,
          })),
        });
      },
    );

    server.registerTool(
      'scope_lookup',
      {
        title: 'Reverse lookup: which programs cover this asset?',
        description:
          'Given a URL or domain, return every program whose scope covers it (wildcard-aware). The "in scope? for whom?" workflow before you touch a target.',
        inputSchema: z.object({
          asset: z.string().describe('A URL, hostname, or domain, e.g. "https://shop.example.com/api" or "example.com".'),
        }),
      },
      async ({ asset }) => {
        const domain = asset
          .replace(/^https?:\/\//i, '')
          .replace(/\/.*$/, '')
          .trim()
          .toLowerCase();
        if (!domain) return json({ error: 'invalid_asset', asset });
        const rows = await findByDomain(domain);
        // Group scope matches per-program so agents see one entry per program.
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
        return json({
          asset: domain,
          matchCount: byProgram.size,
          matches: [...byProgram.values()],
        });
      },
    );

    server.registerTool(
      'whats_new',
      {
        title: 'Recent scope / reward / safe-harbor changes',
        description:
          'Returns non-empty snapshot diffs (scope added, scope removed, reward changed, safe-harbor changed) across all programs in a rolling window.',
        inputSchema: z.object({
          hoursBack: z.number().int().positive().max(720).optional().describe('Window size in hours. Default 168 (7 days), max 720 (30 days).'),
          limit: z.number().int().positive().max(500).optional().describe('Max events. Default 100, hard max 500.'),
        }),
      },
      async ({ hoursBack, limit }) => {
        const changes = await getRecentChanges(hoursBack ?? 168, Math.min(limit ?? 100, 500));
        return json({
          windowHours: hoursBack ?? 168,
          count: changes.length,
          events: changes.map((c) => ({
            program: summarize(c.program as ProgramRow),
            capturedAt: c.capturedAt,
            added: c.diff.added,
            removed: c.diff.removed,
            rewardDelta: c.diff.rewardDelta,
            safeHarborChanged: c.diff.safeHarborChanged,
          })),
        });
      },
    );

    server.registerTool(
      'similar_programs',
      {
        title: 'Programs sharing scope with this one',
        description:
          'Ranks other programs by count of shared in-scope identifiers. Good for exploration ("what else looks like Shopify\'s program").',
        inputSchema: z.object({
          platform: z.string(),
          slug: z.string(),
          limit: z.number().int().positive().max(50).optional(),
        }),
      },
      async ({ platform, slug, limit }) => {
        const target = await getProgramBySlug(platform, slug);
        if (!target) return json({ error: 'not_found', platform, slug });
        const similar = await getSimilarPrograms(target.program.id, Math.min(limit ?? 5, 50));
        return json({
          basePlatform: platform,
          baseSlug: slug,
          similar: similar.map((s) => ({
            ...summarize(s.program as ProgramRow),
            sharedScopeIdentifiers: s.overlap,
          })),
        });
      },
    );

    server.registerTool(
      'program_timeline',
      {
        title: 'Full snapshot timeline for one program',
        description:
          'Every snapshot ever captured for a program (sparse — one row per real change). Oldest first. Use for lifecycle analysis.',
        inputSchema: z.object({
          platform: z.string(),
          slug: z.string(),
        }),
      },
      async ({ platform, slug }) => {
        const target = await getProgramBySlug(platform, slug);
        if (!target) return json({ error: 'not_found', platform, slug });
        const snaps = await getProgramSnapshots(target.program.id);
        return json({
          platform,
          slug,
          snapshotCount: snaps.length,
          timeline: snaps.map((s) => ({
            capturedAt: s.capturedAt,
            inScopeCount: s.payload.inScopeCount,
            scopeCount: s.payload.scopeCount,
            maxBounty: s.payload.maxBounty,
            minBounty: s.payload.minBounty,
            safeHarbor: s.payload.safeHarbor,
            submissionState: s.payload.submissionState,
          })),
        });
      },
    );

    server.registerTool(
      'list_platforms',
      {
        title: 'List platforms + program counts',
        description: 'Which bounty platforms bounty.index tracks, and how many programs on each. Cheap orientation call.',
        inputSchema: z.object({}),
      },
      async () => {
        const rows = await listPlatformsWithCounts();
        return json({
          count: rows.length,
          platforms: rows,
        });
      },
    );
  },
  {
    serverInfo: {
      name: 'bounty-index',
      version: '0.1.0',
    },
    maxSubscriptions: 0,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
