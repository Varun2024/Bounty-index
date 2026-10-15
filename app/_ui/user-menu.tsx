'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { checkIsAdmin } from '@/app/actions/admin';

// Client component. Was server-side (await auth()) which read cookies and forced the entire
// app to dynamic rendering — defeating ISR on every page. Native <details> dropdown still, no
// extra click-outside logic needed. Session is hydrated via next-auth/react.

export function UserMenu() {
  const { data: session, status } = useSession();
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') {
      setAdmin(false);
      return;
    }
    let cancelled = false;
    void checkIsAdmin().then((ok) => { if (!cancelled) setAdmin(ok); }).catch(() => {});
    return () => { cancelled = true; };
  }, [status]);

  // Avoid an auth-state flash while NextAuth hydrates. Fixed-size placeholder keeps header layout stable.
  if (status === 'loading') {
    return <span aria-hidden className="inline-block w-7 h-7 rounded-full border border-neutral-800" />;
  }

  if (!session?.user) {
    return (
      <details className="relative group user-menu">
        <summary
          className="list-none cursor-pointer focus-ring rounded-md"
          aria-label="Open menu"
        >
          <span className="mono text-xs px-3 py-1.5 rounded-md border border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900 group-open:border-neutral-600 group-open:bg-neutral-900 transition inline-flex items-center gap-2">
            <span aria-hidden className="w-4 h-4 rounded-full border border-neutral-700 group-open:border-emerald-400/50 flex items-center justify-center text-[10px] transition">☰</span>
            menu
          </span>
        </summary>

        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] overflow-hidden z-30">
          <div className="px-3 pt-3 pb-1">
            <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">
              no account needed
            </p>
          </div>
          <ul className="pb-2">
            <MenuLink href="/watchlist" icon="★" label="Watchlist" />
            <MenuLink href="/compare" icon="◫" label="Compare" />
          </ul>
          <div className="p-3 border-t border-neutral-900">
            <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              sync across devices
            </p>
            <button
              type="button"
              onClick={() => void signIn('github', { callbackUrl: '/' })}
              className="w-full mono text-xs px-3 py-2 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition focus-ring inline-flex items-center justify-center gap-2"
              title="Sign in with GitHub"
            >
              sign in with GitHub
            </button>
            <p className="mono text-[10px] text-emerald-400/80 text-center mt-2 inline-flex items-center justify-center gap-1.5 w-full">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              2,000+ hunters use this weekly
            </p>
            <p className="mono text-[10px] text-neutral-600 text-center mt-1">
              <span className="text-neutral-700">{'// '}</span>
              no emails. we literally don&rsquo;t ask.
            </p>
          </div>
        </div>
      </details>
    );
  }

  const { user } = session;
  const initial = (user.name ?? user.email ?? '?').charAt(0).toUpperCase();

  return (
    <details className="relative group user-menu">
      <summary
        className="list-none cursor-pointer focus-ring rounded-full"
        aria-label="Open account menu"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            width={28}
            height={28}
            className="w-7 h-7 rounded-full border border-neutral-800 group-hover:border-emerald-400/60 group-open:border-emerald-400/70 transition"
          />
        ) : (
          <span className="w-7 h-7 rounded-full border border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300 mono text-xs font-semibold flex items-center justify-center group-open:border-emerald-400/70 transition">
            {initial}
          </span>
        )}
      </summary>

      <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] overflow-hidden z-30">
        <div className="px-4 py-3 border-b border-neutral-900">
          <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">Signed in</p>
          <p className="mt-1 text-sm text-neutral-100 truncate">{user.name ?? user.email}</p>
          {user.name && user.email ? (
            <p className="mono text-[11px] text-neutral-500 truncate">{user.email}</p>
          ) : null}
        </div>

        <ul className="py-1">
          <MenuLink href="/watchlist" icon="★" label="Watchlist" />
          <MenuLink href="/compare" icon="◫" label="Compare" />
          <MenuLink href="/settings/discord" icon="◈" label="Discord alerts" />
          {admin && <MenuLink href="/admin" icon="⚙" label="Admin" />}
        </ul>

        <div className="border-t border-neutral-900 py-1">
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/' })}
            className="w-full text-left px-4 py-2 text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 transition focus-ring inline-flex items-center gap-3"
          >
            <span aria-hidden className="text-neutral-600 w-4 text-center">↩</span>
            sign out
          </button>
        </div>
      </div>
    </details>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-2 text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-900 transition focus-ring"
      >
        <span aria-hidden className="text-emerald-400/80 w-4 text-center">{icon}</span>
        {label}
      </Link>
    </li>
  );
}
