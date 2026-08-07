import { auth, signIn, signOut } from '@/auth';

// Server component that renders either the Sign In button or the signed-in avatar menu.
// Actions are Server Actions bound to signIn/signOut — no client bundle for auth.
export async function UserMenu() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          'use server';
          await signIn('github', { redirectTo: '/' });
        }}
      >
        <button
          type="submit"
          className="mono text-xs px-3 py-1.5 rounded-md border border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900 focus-ring transition inline-flex items-center gap-2"
          title="Sign in with GitHub"
        >
          <span aria-hidden>▻</span>
          sign in
        </button>
      </form>
    );
  }

  const { user } = session;
  const initial = (user.name ?? user.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt=""
          width={24}
          height={24}
          className="w-6 h-6 rounded-full border border-neutral-800"
        />
      ) : (
        <span className="w-6 h-6 rounded-full border border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300 mono text-[11px] font-semibold flex items-center justify-center">
          {initial}
        </span>
      )}
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/' });
        }}
      >
        <button
          type="submit"
          className="mono text-[11px] text-neutral-500 hover:text-neutral-200 transition focus-ring rounded"
          title="Sign out"
        >
          sign out
        </button>
      </form>
    </div>
  );
}
