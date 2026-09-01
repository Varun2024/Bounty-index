import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDrizzleInstance } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDrizzleInstance(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
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
  // ponytail: temp — Auth.js logger strips NeonDbError message/code. Serialize the full
  // chain so the actual driver complaint lands in Vercel logs. Remove once root-caused.
  logger: {
    error(error) {
      const flatten = (e: unknown, depth = 0): unknown => {
        if (depth > 5 || !e || typeof e !== 'object') return e;
        const err = e as Record<string, unknown> & { cause?: unknown };
        return {
          name: err.name,
          message: err.message,
          code: err.code,
          detail: err.detail,
          hint: err.hint,
          severity: err.severity,
          stack: typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 6).join('\n') : undefined,
          cause: flatten(err.cause, depth + 1),
        };
      };
      console.error('[auth.error]', JSON.stringify(flatten(error), null, 2));
    },
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
