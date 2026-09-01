import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { inspect } from 'node:util';
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
      // util.inspect walks getters + non-enumerable fields, which NeonDbError uses.
      console.error('[auth.error]', inspect(error, { depth: 6, showHidden: true, getters: true }));
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
