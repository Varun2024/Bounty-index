import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'MCP server · Bounty Index',
  description:
    'Connect your Claude Desktop, Cursor, or Codex agent to bounty.index over the Model Context Protocol. v2 beta: 14 tools, 3 prompts, 1 resource.',
  alternates: { canonical: '/mcp' },
};

interface Tool {
  name: string;
  desc: string;
  v2?: boolean;
}

const TOOLS: Tool[] = [
  { name: 'search_programs', desc: 'Keyword + platform + reward + asset-type search. Supports opportunity sort.' },
  { name: 'get_program', desc: 'Full record for one program (headers + scope). Optional include_raw.' },
  { name: 'list_scope', desc: 'Just the scope rows, optionally filtered by asset type.' },
  { name: 'scope_lookup', desc: 'Reverse lookup: which programs cover this URL / domain?' },
  { name: 'whats_new', desc: 'Recent scope / reward / safe-harbor diffs across all programs.' },
  { name: 'similar_programs', desc: 'Rank other programs by shared in-scope identifiers.' },
  { name: 'program_timeline', desc: 'Full snapshot timeline for one program.' },
  { name: 'list_platforms', desc: 'Platforms tracked + program count on each.' },
  { name: 'stats', desc: 'Site-wide totals in one call: programs, paying programs, platforms, last ingest.', v2: true },
  { name: 'top_payouts', desc: 'Leaderboard — top N programs by max bounty.', v2: true },
  { name: 'recently_added', desc: 'Programs first seen within the last N days.', v2: true },
  { name: 'trending_programs', desc: 'Highest-paying new additions in a rolling window.', v2: true },
  { name: 'programs_by_ids', desc: 'Bulk fetch up to 100 program summaries by numeric id.', v2: true },
  { name: 'bulk_scope_lookup', desc: 'Reverse-lookup up to 50 assets in one call.', v2: true },
];

interface Prompt {
  name: string;
  desc: string;
}

const PROMPTS: Prompt[] = [
  { name: 'triage-target', desc: 'Resolve which programs cover an asset, fetch full scope, flag out-of-scope matches.' },
  { name: 'find-high-paying', desc: 'Shortlist high-paying programs by minimum reward and optional asset type.' },
  { name: 'weekly-digest', desc: 'Digest of reward hikes, new in-scope assets, safe-harbor changes.' },
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';
const MCP_URL_V2 = `${SITE_URL}/api/mcp/v2`;
const MCP_URL_V1 = `${SITE_URL}/api/mcp`;

const CLAUDE_DESKTOP_SNIPPET = `{
  "mcpServers": {
    "bounty-index": {
      "url": "${MCP_URL_V2}"
    }
  }
}`;

const CURSOR_SNIPPET = `# ~/.cursor/mcp.json (or project .cursor/mcp.json)
{
  "mcpServers": {
    "bounty-index": {
      "url": "${MCP_URL_V2}"
    }
  }
}`;

export default function McpPage(): React.JSX.Element {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-14">
      <section className="border-b border-neutral-900 pb-8">
        <div className="mono text-[10px] uppercase tracking-widest text-emerald-400/80">
          public beta · v0.2
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50">
          bounty.index MCP
        </h1>
        <p className="mt-4 text-neutral-400 max-w-[62ch] leading-relaxed">
          Wire your agent — Claude Desktop, Cursor, Codex, any Model Context Protocol client — into
          the same index that powers this site. 14 read-only tools, 3 prompts, 1 live resource. No API key,
          no signup, no rate-limit email that says &ldquo;you&rsquo;ve exceeded your free tier&rdquo;.
        </p>
      </section>

      <section className="mt-8">
        <div className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          endpoint
        </div>
        <code className="mono text-sm text-emerald-300 break-all bg-neutral-950/60 border border-neutral-900 rounded-lg px-4 py-3 block">
          {MCP_URL_V2}
        </code>
        <p className="mono text-[11px] text-neutral-500 mt-2">
          Streamable HTTP · stateless · rate-limited to 60 req/min per IP.
        </p>
        <p className="mono text-[11px] text-neutral-500 mt-2">
          v1 remains live at <code className="text-neutral-300">{MCP_URL_V1}</code> for existing clients (8 tools, no prompts).
        </p>
      </section>

      <section className="mt-10">
        <div className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          claude desktop
        </div>
        <p className="mono text-[11px] text-neutral-500 mb-2">
          Add to <code className="text-neutral-300">claude_desktop_config.json</code>, restart Claude.
        </p>
        <pre className="mono text-[12px] text-neutral-300 bg-neutral-950/60 border border-neutral-900 rounded-lg p-4 overflow-x-auto">
{CLAUDE_DESKTOP_SNIPPET}
        </pre>
      </section>

      <section className="mt-8">
        <div className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          cursor
        </div>
        <pre className="mono text-[12px] text-neutral-300 bg-neutral-950/60 border border-neutral-900 rounded-lg p-4 overflow-x-auto">
{CURSOR_SNIPPET}
        </pre>
      </section>

      <section className="mt-12">
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
          tools
        </h2>
        <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
          {TOOLS.map((t, i) => (
            <li
              key={t.name}
              className={`px-4 py-3 ${i === TOOLS.length - 1 ? '' : 'border-b border-neutral-900'}`}
            >
              <div className="flex items-center gap-2">
                <span className="mono text-sm text-emerald-300">{t.name}</span>
                {t.v2 && (
                  <span className="mono text-[10px] text-emerald-400/70 border border-emerald-400/30 rounded px-1.5 py-0.5">
                    v2
                  </span>
                )}
              </div>
              <div className="text-neutral-400 text-sm mt-1">{t.desc}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
          prompts <span className="text-emerald-400/70">· v2</span>
        </h2>
        <p className="text-neutral-400 text-sm mb-4 max-w-[62ch]">
          Pre-wired workflows your agent can invoke by name instead of improvising. Each prompt expands
          into a tool-call plan the model follows.
        </p>
        <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
          {PROMPTS.map((p, i) => (
            <li
              key={p.name}
              className={`px-4 py-3 ${i === PROMPTS.length - 1 ? '' : 'border-b border-neutral-900'}`}
            >
              <div className="mono text-sm text-emerald-300">{p.name}</div>
              <div className="text-neutral-400 text-sm mt-1">{p.desc}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
          resources <span className="text-emerald-400/70">· v2</span>
        </h2>
        <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
          <li className="px-4 py-3">
            <div className="mono text-sm text-emerald-300">stats://overview</div>
            <div className="text-neutral-400 text-sm mt-1">
              Live site-wide totals (programs, paying programs, platforms, last ingest). Zero-tool-call orientation.
            </div>
          </li>
        </ul>
      </section>

      <section className="mt-12 border-t border-neutral-900 pt-8">
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
          coming next
        </h2>
        <ul className="mono text-sm text-neutral-400 space-y-1">
          <li>· watchlist read + write (auth&apos;d)</li>
          <li>· private notes (auth&apos;d)</li>
          <li>· saved filters (auth&apos;d)</li>
          <li>· community response-time reporting (auth&apos;d)</li>
        </ul>
        <p className="mono text-[11px] text-neutral-500 mt-4">
          Auth via personal bearer tokens issued from your signed-in dashboard.
        </p>
      </section>

      <section className="mt-12">
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
