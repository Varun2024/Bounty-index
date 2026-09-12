import Link from 'next/link';

export const metadata = {
  title: 'Sign-in unavailable · Bounty Index',
  robots: { index: false, follow: false },
};

// NextAuth appends ?error=<code> on failure. Adapter errors during a Neon outage surface
// as 'Configuration' or 'OAuthCallback' — treat all of them as a database-paused state
// rather than showing the raw code. Everything read-only still works; only the write to
// the users/accounts tables on first sign-in fails.
const DB_OUTAGE_CODES = new Set([
  'Configuration',
  'OAuthCallback',
  'OAuthCreateAccount',
  'EmailCreateAccount',
  'Callback',
  'AdapterError',
]);

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AuthErrorPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const looksLikeOutage = !error || DB_OUTAGE_CODES.has(error);

  return (
    <div className="max-w-[620px] mx-auto px-6 py-20 text-center">
      <p className="mono text-[10px] uppercase tracking-widest text-amber-400 mb-3">
        {looksLikeOutage ? '// sign-in paused' : '// sign-in failed'}
      </p>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">
        {looksLikeOutage ? 'Sign-in is napping' : 'Sign-in failed'}
      </h1>

      {looksLikeOutage ? (
        <>
          <p className="mt-4 text-sm text-neutral-400 leading-relaxed">
            The database that stores accounts is grumpy right now. New sign-ins are paused for a bit —
            existing sessions are unaffected. Programs, scope lookup, and everything read-only still
            works. Watchlists and Discord alerts will pick up where you left off once the DB is back.
          </p>
          <p className="mt-3 mono text-[11px] text-neutral-600">
            {'// nothing you did is broken — this is on our end.'}
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-neutral-400 leading-relaxed">
            Sign-in didn&rsquo;t complete. The GitHub handshake got interrupted somewhere.
            Try again — it usually just works the second time.
          </p>
          <p className="mt-3 mono text-[11px] text-neutral-600">// error code: {error}</p>
        </>
      )}

      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/programs"
          className="mono text-sm px-4 py-2 border border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300 rounded-md hover:border-emerald-400/70 hover:bg-emerald-400/[0.14] transition focus-ring inline-flex items-center gap-2"
        >
          browse programs anyway →
        </Link>
        <Link
          href="/"
          className="mono text-sm px-4 py-2 border border-neutral-800 rounded-md text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900 transition focus-ring"
        >
          home
        </Link>
      </div>
    </div>
  );
}
