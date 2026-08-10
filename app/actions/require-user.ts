// Shared helper for server actions — resolve the current user id or return null.
// Callers decide whether null means "return empty state" or "throw".

import { auth } from '@/auth';

export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
