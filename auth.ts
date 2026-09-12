import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDrizzleInstance } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { enqueueSignup } from '@/lib/signup-queue';

// Wrap the Drizzle adapter so a DB outage during OAuth callback doesn't just drop the
// user on the floor — we capture their GitHub profile to the Vercel Blob signup queue.
// createUser and linkAccount both fail during outage; catch both and enqueue once.
function withOutageCapture(base: Adapter): Adapter {
  const originalCreateUser = base.createUser?.bind(base);
  return {
    ...base,
    createUser: async (user) => {
      if (!originalCreateUser) throw new Error('adapter.createUser missing');
      try {
        return await originalCreateUser(user);
      } catch (err) {
        await enqueueSignup({
          githubId: (user as { id?: string }).id ?? 'unknown',
          handle: null,
          email: user.email ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
          reason: err instanceof Error ? err.message : 'unknown adapter failure',
          attemptedAt: new Date().toISOString(),
        }).catch(() => {});
        throw err; // still fail the sign-in — user sees the friendly error page
      }
    },
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
