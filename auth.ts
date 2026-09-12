import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDrizzleInstance } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { enqueueSignup } from '@/lib/signup-queue';

// Wrap the Drizzle adapter so a DB outage during OAuth doesn't just drop the user on
// the floor — capture the GitHub profile to the Vercel Blob signup queue.
//
// NextAuth's sign-in path hits multiple adapter methods before createUser:
//   getUserByAccount → getUserByEmail → createUser → linkAccount
// A DB error in any of the read methods bails the whole flow with error=Configuration
// before we ever reach createUser. So: read methods swallow errors and return null
// (letting flow fall through to createUser), and createUser is where we enqueue.
async function enqueueFromUser(user: { id?: string; email?: string | null; name?: string | null; image?: string | null }, reason: string) {
  await enqueueSignup({
    githubId: user.id ?? 'unknown',
    handle: null,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    reason,
    attemptedAt: new Date().toISOString(),
  }).catch(() => {});
}

async function nullOnError<T>(runner: () => unknown): Promise<T | null> {
  try {
    return (await runner()) as T | null;
  } catch {
    return null;
  }
}

function withOutageCapture(base: Adapter): Adapter {
  return {
    ...base,
    getUser: base.getUser ? (id) => nullOnError(() => base.getUser!(id)) : undefined,
    getUserByEmail: base.getUserByEmail ? (email) => nullOnError(() => base.getUserByEmail!(email)) : undefined,
    getUserByAccount: base.getUserByAccount
      ? (account) => nullOnError(() => base.getUserByAccount!(account))
      : undefined,
    createUser: base.createUser
      ? async (user) => {
          try {
            return await base.createUser!(user);
          } catch (err) {
            await enqueueFromUser(user, err instanceof Error ? err.message : 'createUser failed');
            throw err;
          }
        }
      : undefined,
    linkAccount: base.linkAccount
      ? async (account): Promise<void> => {
          try {
            await base.linkAccount!(account);
          } catch (err) {
            await enqueueSignup({
              githubId: String(account.providerAccountId ?? 'unknown'),
              handle: null,
              email: null,
              name: null,
              image: null,
              reason: `linkAccount failed: ${err instanceof Error ? err.message : 'unknown'}`,
              attemptedAt: new Date().toISOString(),
            }).catch(() => {});
            throw err;
          }
        }
      : undefined,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: withOutageCapture(
    DrizzleAdapter(getDrizzleInstance(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
  ),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  // JWT sessions instead of database sessions: authenticated browsing never touches the DB,
  // so a Neon quota / outage doesn't break sign-in redirect. Adapter still writes user +
  // account rows on first-time OAuth (that's identity persistence). Existing DB sessions
  // are invalidated by this switch — every user re-signs-in once.
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    // Custom error page interprets DB-outage failures as a paused-sign-in state instead
    // of the default NextAuth stack trace. Existing sessions still work; only new ones fail.
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
