'use server';

import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

// Client-callable admin check. The admin email list is server-only (ADMIN_EMAILS env var),
// and we don't want to leak it to the client bundle via NEXT_PUBLIC — so expose a boolean
// through a server action instead.
export async function checkIsAdmin(): Promise<boolean> {
  return isAdmin(await auth());
}
