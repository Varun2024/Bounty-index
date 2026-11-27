import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { getMyTokens } from '@/app/actions/mcp-tokens';
import { UnavailablePanel } from '@/app/_ui/unavailable-panel';
import { TokenManager } from './token-manager';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MCP tokens · Bounty Index',
  description: 'Create API tokens so your AI agent can take actions through the bounty.index MCP, like subscribing a program to Discord alerts.',
  alternates: { canonical: '/settings/mcp' },
};

const MCP_URL = 'https://bountyindex.in/api/mcp/v2';

export default async function McpTokensPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const tokens = signedIn ? await getMyTokens().catch(() => null) : [];

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <header className="border-b border-neutral-900 pb-6 mb-8">
        <p className="mono text-[11px] uppercase tracking-widest text-neutral-400 mb-2">Settings · MCP tokens</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">MCP tokens</h1>
        <p className="mt-3 text-sm text-neutral-400 max-w-2xl leading-relaxed">
          The bounty.index MCP is open for reading. Actions that change your data, like subscribing a program to
          Discord alerts, need a token tied to your account. Create one here, put it in your MCP client, and your agent
          can act as you.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">How your agent uses it</h2>
        <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
          Point your MCP client at the v2 endpoint and send the token as a bearer header. Read tools work without it;
          write tools (<span className="mono text-neutral-300">subscribe_program</span>,{' '}
          <span className="mono text-neutral-300">unsubscribe_program</span>,{' '}
          <span className="mono text-neutral-300">list_my_subscriptions</span>) use it to know who you are.
        </p>
        <pre className="rounded-lg border border-neutral-900 bg-neutral-950/60 p-4 overflow-x-auto mono text-[12px] leading-relaxed text-neutral-300">{`{
  "mcpServers": {
    "bounty-index": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}`}</pre>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
          Treat a token like a password. Anyone with it can act on your account. Revoke one here the moment it leaks.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">Your tokens</h2>
        {!signedIn ? (
          <div className="border border-neutral-900 rounded-lg p-8 bg-neutral-950/40 text-center">
            <p className="mono text-xs uppercase tracking-widest text-neutral-400">sign in required</p>
            <p className="mt-3 text-sm text-neutral-400">
              Tokens are tied to your account.{' '}
              <Link href="/api/auth/signin" className="text-emerald-400 hover:underline">
                Sign in with GitHub
              </Link>{' '}
              to create one.
            </p>
          </div>
        ) : tokens === null ? (
          <UnavailablePanel what="Token list" />
        ) : (
          <TokenManager initialTokens={tokens} />
        )}
      </section>
    </div>
  );
}
