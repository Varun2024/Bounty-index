import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'MCP server · Bounty Index',
  description:
    'Connect your Claude Desktop, Cursor, or Codex agent to bounty.index over the Model Context Protocol. Public beta, 8 read-only tools.',
  alternates: { canonical: '/mcp' },
};

interface Tool {
  name: string;
  desc: string;
}

const TOOLS: Tool[] = [
  { name: 'search_programs', desc: 'Keyword + platform + reward + asset-type search.' },
  { name: 'get_program', desc: 'Full record for one program (headers + scope). Optional include_raw.' },
  { name: 'list_scope', desc: 'Just the scope rows, optionally filtered by asset type.' },
  { name: 'scope_lookup', desc: 'Reverse lookup: which programs cover this URL / domain?' },
  { name: 'whats_new', desc: 'Recent scope / reward / safe-harbor diffs across all programs.' },
  { name: 'similar_programs', desc: 'Rank other programs by shared in-scope identifiers.' },
  { name: 'program_timeline', desc: 'Full snapshot timeline for one program.' },
  { name: 'list_platforms', desc: 'Platforms tracked + program count on each.' },
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';
const MCP_URL = `${SITE_URL}/api/mcp`;

const CLAUDE_DESKTOP_SNIPPET = `{
  "mcpServers": {
    "bounty-index": {
      "url": "${MCP_URL}"
    }
  }
}`;

const CURSOR_SNIPPET = `# ~/.cursor/mcp.json (or project .cursor/mcp.json)
{
  "mcpServers": {
    "bounty-index": {
      "url": "${MCP_URL}"
    }
  }
}`;

export default function McpPage(): React.JSX.Element {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-14">
      {/* Header */}
      <section className="border-b border-neutral-900 pb-8">
        <div className="mono text-[10px] uppercase tracking-widest text-emerald-400/80">
          public beta · v0.1
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50">
          bounty.index MCP
        </h1>
        <p className="mt-4 text-neutral-400 max-w-[62ch] leading-relaxed">
          Wire your agent — Claude Desktop, Cursor, Codex, any Model Context Protocol client — into
          the same index that powers this site. Eight public read-only tools. No API key, no signup.
          Same fallback story as the web UI: if Neon is down, the tools still answer from the
          upstream mirror.
        </p>
      </section>

      {/* Connection URL */}
      <section className="mt-8">
        <div className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          endpoint
        </div>
        <code className="mono text-sm text-emerald-300 break-all bg-neutral-950/60 border border-neutral-900 rounded-lg px-4 py-3 block">
          {MCP_URL}
        </code>
        <p className="mono text-[11px] text-neutral-500 mt-2">
          Streamable HTTP · stateless · rate-limited to 60 req/min per IP.
        </p>
      </section>

      {/* Quickstart */}
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

      {/* Tools */}
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
              <div className="mono text-sm text-emerald-300">{t.name}</div>
              <div className="text-neutral-400 text-sm mt-1">{t.desc}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Roadmap */}
      <section className="mt-12 border-t border-neutral-900 pt-8">
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
          coming in v1.1
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
