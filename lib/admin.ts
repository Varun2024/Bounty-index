// Admin gating. Compares the current session's email against ADMIN_EMAILS
// (comma-separated env var). Return-404 pattern on non-admin so admin surface
// doesn't leak its existence.

import type { Session } from 'next-auth';

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(session: Session | null): boolean {
  const email = session?.user?.email?.toLowerCase();
  if (!email) return false;
  const allow = adminEmails();
  return allow.includes(email);
}
