'use client';

import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';

// Support card for the MCP page. Lives in a sticky right rail (see page.tsx) so it stays in
// view while the capability list scrolls, instead of sitting at the very bottom. This page
// gets heavy agent-builder traffic and pitches "no key, no signup" up top, so support stays
// strictly optional and never gates the endpoint. Sign-in is hidden once authenticated.
// On mobile the rail collapses and this flows below the content.
const COFFEE_URL = 'https://buymeacoffee.com/varun_builds'; // also in support-nudge.tsx + footer

export function McpSupport() {
  const { status } = useSession();
  const authed = status === 'authenticated';

  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950/40 p-5">
      <h2 className="text-base font-semibold tracking-tight text-neutral-100">
        No key. No signup.
      </h2>
      <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
        {authed
          ? 'One person’s Neon bill. Glad it’s earning its place in your agent. A coffee goes straight to the server that answers these calls.'
          : 'One person’s Neon bill. The endpoint stays free and ungated; these two optional things keep it running.'}
      </p>

      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 w-full inline-flex items-center justify-center gap-2 mono text-sm px-4 py-2 border border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 rounded-md hover:border-emerald-400/60 hover:bg-emerald-400/[0.12] transition focus-ring"
      >
        <span aria-hidden>&#9749;</span>
        buy me a coffee
      </a>

      {!authed && (
        <button
          type="button"
          onClick={() => void signIn('github')}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 mono text-sm px-4 py-2 border border-neutral-800 text-neutral-200 rounded-md hover:border-neutral-700 hover:text-neutral-50 transition focus-ring"
        >
          sign in with GitHub
        </button>
      )}

      {!authed && (
        <p className="mt-3 mono text-[11px] text-neutral-500 leading-relaxed">
          Saves programs and syncs your watchlist across devices. GitHub only, no email, we
          can&rsquo;t spam you.
        </p>
      )}

      <Link
        href="/how-it-works"
        className="mt-4 inline-block mono text-xs text-neutral-500 hover:text-emerald-300 transition"
      >
        how the index is built &rarr;
      </Link>
    </div>
  );
}
