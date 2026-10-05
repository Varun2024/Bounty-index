import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'MCP server · Bounty Index',
  description:
    'Connect your Claude Desktop, Cursor, or Codex agent to bounty.index over the Model Context Protocol. v2 beta: 14 tools, 3 prompts, 1 resource.',
  alternates: { canonical: '/mcp' },
};

interface Capability {
  name: string;
  desc: string;
  v2?: boolean;
}

const TOOLS: Capability[] = [
  { name: 'search_programs', desc: 'Keyword + platform + reward + asset-type search. Supports opportunity sort.' },
  { name: 'get_program', desc: 'Full record for one program (headers + scope). Optional include_raw.' },
  { name: 'list_scope', desc: 'Just the scope rows, optionally filtered by asset type.' },
  { name: 'scope_lookup', desc: 'Reverse lookup: which programs cover this URL / domain?' },
  { name: 'whats_new', desc: 'Recent scope / reward / safe-harbor diffs across all programs.' },
  { name: 'similar_programs', desc: 'Rank other programs by shared in-scope identifiers.' },
  { name: 'program_timeline', desc: 'Full snapshot timeline for one program.' },
  { name: 'list_platforms', desc: 'Platforms tracked + program count on each.' },
  { name: 'stats', desc: 'Site-wide totals: programs, paying programs, platforms, last ingest.', v2: true },
  { name: 'top_payouts', desc: 'Leaderboard — top N programs by max bounty.', v2: true },
  { name: 'recently_added', desc: 'Programs first seen within the last N days.', v2: true },
  { name: 'trending_programs', desc: 'Highest-paying new additions in a rolling window.', v2: true },
  { name: 'programs_by_ids', desc: 'Bulk fetch up to 100 program summaries by numeric id.', v2: true },
  { name: 'bulk_scope_lookup', desc: 'Reverse-lookup up to 50 assets in one call.', v2: true },
];

const PROMPTS: Capability[] = [
  { name: 'triage-target', desc: 'Resolve which programs cover an asset, fetch full scope, flag out-of-scope matches.' },
  { name: 'find-high-paying', desc: 'Shortlist high-paying programs by minimum reward and optional asset type.' },
  { name: 'weekly-digest', desc: 'Digest of reward hikes, new in-scope assets, safe-harbor changes.' },
];

const RESOURCES: Capability[] = [
  { name: 'stats://overview', desc: 'Live site-wide totals. Zero-tool-call orientation.' },
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';
const MCP_URL_V2 = `${SITE_URL}/api/mcp/v2`;
const MCP_URL_V1 = `${SITE_URL}/api/mcp`;

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "bounty-index": {
      "url": "${MCP_URL_V2}"
    }
  }
}`;

function Card({ item }: { item: Capability }) {
  return (
    <div className="border border-neutral-900 rounded-lg bg-neutral-950/40 px-4 py-3 hover:border-neutral-800 transition">
      <div className="flex items-center gap-2">
        <span className="mono text-sm text-emerald-300 break-all">{item.name}</span>
        {item.v2 && (
          <span className="mono text-[10px] text-emerald-400/70 border border-emerald-400/30 rounded px-1.5 py-0.5 shrink-0">
            v2
          </span>
        )}
      </div>
      <div className="text-neutral-400 text-sm mt-1 leading-snug">{item.desc}</div>
    </div>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500">{children}</h2>
      {count !== undefined && <span className="mono text-[10px] text-neutral-600">{count}</span>}
    </div>
  );
}

export default function McpPage(): React.JSX.Element {
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-14">
      {/* Masthead — two-col: pitch left, specs right */}
      <section className="grid md:grid-cols-[1fr_auto] gap-8 md:gap-12 items-end border-b border-neutral-900 pb-10">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest text-emerald-400/80">
            public beta · v0.2
          </div>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50">
            bounty.index MCP
          </h1>
          <p className="mt-4 text-neutral-400 max-w-[58ch] leading-relaxed">
            Wire your agent — Claude Desktop, Cursor, Codex, any Model Context Protocol client — into
            the same index that powers this site. No API key, no signup.
          </p>
        </div>
        <dl className="grid grid-cols-4 md:grid-cols-2 gap-x-6 gap-y-3 mono text-[11px] md:text-right">
          <div>
            <dt className="text-neutral-500">tools</dt>
            <dd className="text-neutral-100 tabular-nums text-base">14</dd>
          </div>
          <div>
            <dt className="text-neutral-500">prompts</dt>
            <dd className="text-neutral-100 tabular-nums text-base">3</dd>
          </div>
          <div>
            <dt className="text-neutral-500">resources</dt>
            <dd className="text-neutral-100 tabular-nums text-base">1</dd>
          </div>
          <div>
            <dt className="text-neutral-500">rate limit</dt>
            <dd className="text-neutral-100 tabular-nums text-base">60/min</dd>
          </div>
        </dl>
      </section>

      {/* Endpoint + Config side-by-side on desktop */}
      <section className="mt-10 grid lg:grid-cols-2 gap-8">
        <div>
          <SectionLabel>endpoint</SectionLabel>
          <code className="mono text-sm text-emerald-300 break-all bg-neutral-950/60 border border-neutral-900 rounded-lg px-4 py-3 block">
            {MCP_URL_V2}
          </code>
          <p className="mono text-[11px] text-neutral-500 mt-3 leading-relaxed">
            Streamable HTTP · stateless. v1 remains at{' '}
            <code className="text-neutral-300 break-all">{MCP_URL_V1}</code> for existing clients (8 tools, no prompts).
          </p>
        </div>

        <div>
          <SectionLabel>config</SectionLabel>
          <pre className="mono text-[12px] text-neutral-300 bg-neutral-950/60 border border-neutral-900 rounded-lg p-4 overflow-x-auto">
{CONFIG_SNIPPET}
          </pre>
          <p className="mono text-[11px] text-neutral-500 mt-3 leading-relaxed">
            Same JSON works for Claude Desktop (<code className="text-neutral-300">claude_desktop_config.json</code>)
            and Cursor (<code className="text-neutral-300">~/.cursor/mcp.json</code>). Restart the client.
          </p>
        </div>
      </section>

      {/* Tools — 2-col grid */}
      <section className="mt-14">
        <SectionLabel count={TOOLS.length}>tools</SectionLabel>
        <div className="grid md:grid-cols-2 gap-3">
          {TOOLS.map((t) => <Card key={t.name} item={t} />)}
        </div>
      </section>

      {/* Prompts + Resources — side-by-side */}
      <section className="mt-12 grid lg:grid-cols-[2fr_1fr] gap-8">
        <div>
          <SectionLabel count={PROMPTS.length}>
            prompts <span className="text-emerald-400/60 normal-case tracking-normal">· v2</span>
          </SectionLabel>
          <p className="text-neutral-400 text-sm mb-3 max-w-[58ch] leading-snug">
            Pre-wired workflows your agent invokes by name instead of improvising.
          </p>
          <div className="grid gap-3">
            {PROMPTS.map((p) => <Card key={p.name} item={p} />)}
          </div>
        </div>

        <div>
          <SectionLabel count={RESOURCES.length}>
            resources <span className="text-emerald-400/60 normal-case tracking-normal">· v2</span>
          </SectionLabel>
          <p className="text-neutral-400 text-sm mb-3 leading-snug">
            Live data your agent can bind to without a tool call.
          </p>
          <div className="grid gap-3">
            {RESOURCES.map((r) => <Card key={r.name} item={r} />)}
          </div>
        </div>
      </section>

      <section className="mt-14 border-t border-neutral-900 pt-6">
        <Link
          href="/how-it-works"
          className="mono text-xs text-neutral-500 hover:text-emerald-300 transition"
        >
          how the index is built →
        </Link>
      </section>
    </div>
  );
}
