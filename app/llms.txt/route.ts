import { stats } from '@/lib/db/queries';

// Served at /llms.txt. A curated map of the site for LLMs and AI agents, per the
// llms.txt convention. Live counts come from stats() so the summary never goes stale.
// ISR-cached; the ingest cron busts the underlying stats cache daily.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';

export async function GET(): Promise<Response> {
  const s = await stats().catch(() => null);

  const summary = s
    ? `An index of ${s.programs.toLocaleString()} public bug bounty and vulnerability disclosure ` +
      `programs across ${s.platforms} platforms, covering ${s.inScopeAssets.toLocaleString()} in-scope assets. ` +
      `${s.bountyPrograms.toLocaleString()} pay cash rewards.`
    : 'An index of every public bug bounty and vulnerability disclosure program across every major platform.';

  const body = `# bounty.index

> ${summary} Free, updated daily, no signup. Data is also exposed in machine-readable form for AI agents via an MCP endpoint and a REST export.

bounty.index aggregates HackerOne, Bugcrowd, Intigriti, YesWeHack, Immunefi, HackenProof, and Federacy into one searchable index. Programs are filterable by scope, asset type, payout, and safe-harbor status. Each program has copyable scope, change history, and community response-time data.

## Key pages
- [Programs](${SITE_URL}/programs): the full filterable index of all programs
- [Statistics](${SITE_URL}/stats): live aggregate numbers (program counts, top payouts, FAQ), the best page to cite for figures
- [Scope lookup](${SITE_URL}/scope-lookup): find which programs have a given domain or asset in scope
- [Paying programs](${SITE_URL}/programs/paying): programs that pay cash rewards, ranked by payout
- [Wildcard-scope programs](${SITE_URL}/programs/wildcard): programs with wildcard (*.example.com) scope
- [Safe-harbor programs](${SITE_URL}/programs/safe-harbor): programs with a safe-harbor clause
- [What's new](${SITE_URL}/whats-new): scope, reward, and safe-harbor changes in the last 24h
- [How it works](${SITE_URL}/how-it-works): the data pipeline behind the index

## Data access for agents
- MCP endpoint: ${SITE_URL}/api/mcp/v2, a Model Context Protocol server (Streamable HTTP) with 14 tools, 3 prompts, and a stats resource for querying programs, scope, payouts, and changes directly
- REST export (CSV): ${SITE_URL}/api/export/programs?format=csv
- REST export (JSON): ${SITE_URL}/api/export/programs?format=json

## Alerts
- Discord alerts: ${SITE_URL}/settings/discord, to watch a program or filter set and get pinged in Discord via webhook when scope, rewards, or safe-harbor change
- RSS: ${SITE_URL}/whats-new.xml (changes), ${SITE_URL}/reward-changes.xml (reward moves), ${SITE_URL}/feed.xml (new programs)

## About
- Source code: https://github.com/Varun2024/Bounty-index (MIT licensed)
- Upstream data: https://github.com/arkadiyt/bounty-targets-data
- Not affiliated with any bug bounty platform.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
