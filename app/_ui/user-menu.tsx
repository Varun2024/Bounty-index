import Link from 'next/link';
import { auth, signIn, signOut } from '@/auth';

// Server component. Native <details> dropdown when signed in — no JS bundle, no
// custom outside-click handler; menu closes when the user picks a link
// (navigation swaps the tree) or clicks the summary again.

export async function UserMenu() {
  const session = await auth();

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

        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] overflow-hidden z-30">
          <form
            action={async () => {
              'use server';
              await signIn('github', { redirectTo: '/' });
            }}
            className="p-3 border-b border-neutral-900"
          >
            <button
              type="submit"
              className="w-full mono text-xs px-3 py-2 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition focus-ring inline-flex items-center justify-center gap-2"
              title="Sign in with GitHub"
            >
              sign in with GitHub
            </button>
            <p className="mono text-[10px] text-neutral-600 text-center mt-2">
              <span className="text-neutral-700">{'// '}</span>
              sync across devices
            </p>
          </form>
          <ul className="py-1">
            <MenuLink href="/watchlist" icon="★" label="Watchlist" />
            <MenuLink href="/compare" icon="◫" label="Compare" />
          </ul>
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
        </ul>

        <div className="border-t border-neutral-900 py-1">
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button
              type="submit"
              className="w-full text-left px-4 py-2 text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 transition focus-ring inline-flex items-center gap-3"
            >
              <span aria-hidden className="text-neutral-600 w-4 text-center">↩</span>
              sign out
            </button>
          </form>
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
