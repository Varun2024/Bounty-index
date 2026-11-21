import { z } from 'zod';
import { after } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  listPrograms,
  getProgramBySlug,
  findByDomain,
  getRecentChanges,
  getSimilarPrograms,
  getProgramSnapshots,
  listPlatformsWithCounts,
} from '@/lib/db/queries';
import { db } from '@/lib/db/client';
import { mcpHits } from '@/lib/db/schema';

function clientIp(req: Request): string | null {
  // On Vercel, x-vercel-forwarded-for / x-real-ip are proxy-set and not client-forgeable, so
  // prefer them. x-forwarded-for's first value is only trustworthy while Vercel is the outermost
  // proxy (put a CDN in front and a client could forge it to evade or poison the rate limit).
  const trusted = req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-real-ip');
  if (trusted) return trusted.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return null;
}

// Per-IP rate limit. The endpoint is public and unauthenticated, and every tool call hits
// Neon, so a scraper looping a tool could run up the DB bill unchecked. We count this IP's
// recent hits (the row set we already log) and 429 past the cap.
// ponytail: fixed window, DB-backed, approximate — the count reads rows logged after prior
// handlers, so a tight burst can momentarily undercount (permissive, never over-blocks).
// Upgrade to a token bucket in Upstash/KV only if this ever needs to be exact or cheaper.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 150; // generous for a real agent session; stops sustained abuse

async function isRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false; // can't attribute (no XFF) → don't block; shared NATs would be collateral
  try {
    const since = new Date(Date.now() - RATE_WINDOW_MS);
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(mcpHits)
      .where(and(eq(mcpHits.ip, ip), gte(mcpHits.ts, since)));
    return (row?.c ?? 0) >= RATE_MAX_PER_WINDOW;
  } catch {
    return false; // fail-open: a limiter outage must never take the endpoint down
  }
}

// Peek the JSON-RPC method / tool name off a CLONE so the real handler still gets the body.
async function peekTool(req: Request): Promise<string | null> {
  try {
    const body = (await req.clone().json()) as { method?: unknown; params?: { name?: unknown } };
    // Truncate: `params.name` is untrusted and could be megabytes (table-bloat vector).
    if (body?.method === 'tools/call' && typeof body.params?.name === 'string') return body.params.name.slice(0, 100);
    return typeof body?.method === 'string' ? body.method.slice(0, 100) : null;
  } catch {
    return null;
  }
}

// Log one usage row (headers + which tool + how long it took). Best-effort: a logging
// failure must never break the MCP call.
async function logMcpHit(
  req: Request,
  version: 'v1' | 'v2',
  tool: string | null,
  durationMs: number,
): Promise<void> {
  const ip = clientIp(req)?.slice(0, 45) ?? null; // cap at max IPv6 length
  const ua = req.headers.get('user-agent')?.slice(0, 500) ?? null;
  try {
    await db.insert(mcpHits).values({ version, ip, ua, tool, durationMs });
  } catch {
    // If the tool/duration_ms columns aren't present yet (code deployed ahead of migration 004),
    // fall back to the base row so usage logging — and the rate-limit count that reads it — never
    // regress. Deploy order then doesn't matter. Best-effort throughout.
    try {
      await db.insert(mcpHits).values({ version, ip, ua });
    } catch {
      // swallow — usage logging is non-critical
    }
  }
}

function rateLimitedResponse(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'Rate limit exceeded. Slow down and retry shortly.' },
    }),
    {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': String(Math.ceil(RATE_WINDOW_MS / 1000)) },
    },
  );
}

type RouteHandler = (req: Request) => Promise<Response>;

// Wrap an mcp-handler route so every POST (a JSON-RPC call) is rate-limited and counted. GET
// is the SSE stream negotiation and would double-count a session, so only POSTs are handled.
// The rate-limit check is awaited (one indexed COUNT) before the handler; the usage insert
// fires after, without blocking the response.
export function withMcpLogging(handler: RouteHandler, version: 'v1' | 'v2'): RouteHandler {
  return async (req) => {
    if (req.method !== 'POST') return handler(req);
    const ip = clientIp(req);
    if (await isRateLimited(ip)) return rateLimitedResponse();
    const tool = await peekTool(req);
    const start = Date.now();
    try {
      return await handler(req);
    } finally {
      // finally: count + record even when the handler throws, so failed calls still hit the cap.
      // after(): on Vercel, work kicked off post-response can be frozen/dropped; after() guarantees
      // the insert runs in this invocation after the response is sent, off the response's critical path.
      const durationMs = Date.now() - start;
      after(() => logMcpHit(req, version, tool, durationMs));
    }
  };
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';

export function json(text: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(text, null, 2) }] };
}

export function programUrl(platform: string, slug: string): string {
  const encPlatform = encodeURIComponent(platform);
  const encSlug = slug.split('/').map(encodeURIComponent).join('/');
  return `${SITE_URL}/programs/${encPlatform}/${encSlug}`;
}

export interface ProgramSummary {
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

export interface ProgramRow {
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

export function summarize(p: ProgramRow): ProgramSummary {
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

export function normalizeAsset(asset: string): string {
  return asset
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
}

// The eight read-only tools shipped in v1. v2 re-registers them so clients only
// need to configure one endpoint to get everything.
export function registerCoreTools(server: McpServer): void {
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
        sort: z.enum(['newest', 'reward', 'name', 'opportunity']).optional(),
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
      return json({ total, page, pageSize, results: rows.map(summarize) });
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
      title: "List a program's scope entries",
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
      const domain = normalizeAsset(asset);
      if (!domain) return json({ error: 'invalid_asset', asset });
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
        'Returns non-empty snapshot diffs (scope added, scope removed, reward changed, safe-harbor changed, VDP↔paid transition, status changed) across all programs in a rolling window.',
      inputSchema: z.object({
        hoursBack: z.number().int().positive().max(720).optional().describe('Window size in hours. Default 168 (7 days), max 720 (30 days).'),
        limit: z.number().int().positive().max(500).optional().describe('Max events. Default 100, hard max 500.'),
        since: z
          .string()
          .datetime()
          .optional()
          .describe('ISO timestamp cursor: return only events captured strictly after it. Pass back the `nextCursor` from your last call to poll incrementally without re-fetching or missing events.'),
      }),
    },
    async ({ hoursBack, limit, since }) => {
      const changes = await getRecentChanges(hoursBack ?? 168, Math.min(limit ?? 100, 500));
      const sinceMs = since ? Date.parse(since) : NaN;
      const events = (Number.isNaN(sinceMs) ? changes : changes.filter((c) => c.capturedAt.getTime() > sinceMs)).map((c) => ({
        program: summarize(c.program as ProgramRow),
        capturedAt: c.capturedAt,
        added: c.diff.added,
        removed: c.diff.removed,
        rewardDelta: c.diff.rewardDelta,
        safeHarborChanged: c.diff.safeHarborChanged,
        bountyTransition: c.diff.bountyTransition,
        statusChange: c.diff.statusChange,
      }));
      // Cursor = newest capturedAt in this window (independent of the `since` filter), so a follow-up
      // call with since=nextCursor advances even when this page returned nothing new.
      const nextCursor =
        changes.reduce<number>((max, c) => Math.max(max, c.capturedAt.getTime()), 0) || null;
      return json({
        windowHours: hoursBack ?? 168,
        count: events.length,
        nextCursor: nextCursor ? new Date(nextCursor).toISOString() : null,
        events,
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
        'Every snapshot ever captured for a program (sparse, one row per real change). Oldest first. Use for lifecycle analysis.',
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
      return json({ count: rows.length, platforms: rows });
    },
  );
}
