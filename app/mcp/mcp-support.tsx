'use client';

import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';

// Support band for the MCP page. This page gets heavy agent-builder traffic and pitches
// "no key, no signup" up top, so support stays strictly optional and lives at the bottom,
// after the config has been handed over. Two quiet asks: a coffee (server bill) and sign-in
// (watchlist sync), never gating the endpoint. Sign-in is hidden once authenticated.
const COFFEE_URL = 'https://buymeacoffee.com/varun_builds'; // also in support-nudge.tsx + footer

export function McpSupport() {
  const { status } = useSession();
  const authed = status === 'authenticated';

  return (
    <section className="mt-16 border-t border-neutral-900 pt-10">
      <div className="grid lg:grid-cols-[1fr_auto] gap-8 lg:gap-12 items-start">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-100">
            No key. No signup. One person&rsquo;s Neon bill.
          </h2>
          <p className="mt-3 text-neutral-400 text-sm leading-relaxed max-w-[56ch]">
            {authed
              ? 'The endpoint stays free and ungated. Glad it’s earning its place in your agent. A coffee goes straight to the server that answers these calls.'
              : 'The endpoint stays free and ungated. If it’s pulling its weight in your agent, two optional things keep it running. Neither touches your access.'}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={COFFEE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 mono text-sm px-4 py-2 border border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 rounded-md hover:border-emerald-400/60 hover:bg-emerald-400/[0.12] transition focus-ring"
            >
              <span aria-hidden>&#9749;</span>
              buy me a coffee
            </a>

            {!authed && (
              <button
                type="button"
                onClick={() => void signIn('github')}
                className="inline-flex items-center gap-2 mono text-sm px-4 py-2 border border-neutral-800 text-neutral-200 rounded-md hover:border-neutral-700 hover:text-neutral-50 transition focus-ring"
              >
                sign in with GitHub
              </button>
            )}
          </div>

          {!authed && (
            <p className="mt-3 mono text-[11px] text-neutral-500 leading-relaxed max-w-[56ch]">
              Signing in saves programs and syncs your watchlist across devices, so the same list
              shows up when you query the site by hand. GitHub only, no email, we can&rsquo;t spam you.
            </p>
          )}
        </div>

        <Link
          href="/how-it-works"
          className="mono text-xs text-neutral-500 hover:text-emerald-300 transition shrink-0"
        >
          how the index is built &rarr;
        </Link>
      </div>
    </section>
  );
}
