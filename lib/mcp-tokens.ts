// Per-account MCP API tokens. Backs the write/action MCP tools (public reads need no token).
// We store only the SHA-256 hash; the plaintext is returned once at creation and never again.
// ponytail: SHA-256 of a 192-bit random token is fine here — the token IS the secret (high
// entropy, not a human password), so a slow KDF buys nothing. Lookup is a single indexed hash match.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './db/client';
import { mcpTokens } from './db/schema';

const TOKEN_PREFIX = 'bi_';
const MAX_TOKENS_PER_USER = 10; // stop unbounded token creation

export function generateMcpToken(): string {
  // 24 random bytes -> 32 base64url chars, 192 bits of entropy.
  return TOKEN_PREFIX + randomBytes(24).toString('base64url');
}

export function hashMcpToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function looksLikeMcpToken(token: string): boolean {
  return /^bi_[A-Za-z0-9_-]{32,}$/.test(token.trim());
}

export interface CreatedToken {
  id: string;
  token: string; // plaintext — shown once
}

// Create a token for a user. Returns the plaintext ONCE; only the hash is stored.
export async function createMcpToken(userId: string, label?: string): Promise<CreatedToken> {
  const active = await db
    .select({ id: mcpTokens.id })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)));
  if (active.length >= MAX_TOKENS_PER_USER) {
    throw new Error(`Token limit reached (${MAX_TOKENS_PER_USER}). Revoke one first.`);
  }
  const token = generateMcpToken();
  const cleanLabel = label?.trim().slice(0, 80) || null;
  const [row] = await db
    .insert(mcpTokens)
    .values({ userId, tokenHash: hashMcpToken(token), label: cleanLabel })
    .returning({ id: mcpTokens.id });
  return { id: row.id, token };
}

// Resolve a bearer token to its owning user. Returns null for missing/invalid/revoked.
export async function verifyMcpToken(token: string | undefined | null): Promise<{ userId: string; tokenId: string } | null> {
  if (!token || !looksLikeMcpToken(token)) return null;
  const hash = hashMcpToken(token);
  const [row] = await db
    .select({ id: mcpTokens.id, userId: mcpTokens.userId, tokenHash: mcpTokens.tokenHash })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, hash), isNull(mcpTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  // Defensive constant-time recheck (the WHERE already matched on the unique hash).
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId: row.userId, tokenId: row.id };
}

export interface TokenRow {
  id: string;
  label: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export async function listMcpTokens(userId: string): Promise<TokenRow[]> {
  return db
    .select({ id: mcpTokens.id, label: mcpTokens.label, createdAt: mcpTokens.createdAt, lastUsedAt: mcpTokens.lastUsedAt })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)))
    .orderBy(desc(mcpTokens.createdAt));
}

// Revoke a token the user owns. Returns true if a token was revoked.
export async function revokeMcpToken(userId: string, tokenId: string): Promise<boolean> {
  const rows = await db
    .update(mcpTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpTokens.id, tokenId), eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)))
    .returning({ id: mcpTokens.id });
  return rows.length > 0;
}

// ponytail self-check (pure fns only; DB offline): `npx tsx lib/mcp-tokens.ts`
if (require.main === module) {
  const t1 = generateMcpToken();
  const t2 = generateMcpToken();
  const checks: Array<[string, boolean]> = [
    ['token has prefix', t1.startsWith('bi_')],
    ['tokens are unique', t1 !== t2],
    ['token matches shape', looksLikeMcpToken(t1)],
    ['rejects junk shape', !looksLikeMcpToken('nope') && !looksLikeMcpToken('bi_short')],
    ['hash is deterministic', hashMcpToken(t1) === hashMcpToken(t1)],
    ['different tokens hash differently', hashMcpToken(t1) !== hashMcpToken(t2)],
    ['hash is sha256 hex (64 chars)', /^[0-9a-f]{64}$/.test(hashMcpToken(t1))],
    ['hash trims input', hashMcpToken(t1) === hashMcpToken('  ' + t1 + '  ')],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'ok ' : 'FAIL'} ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? 'mcp-tokens self-check passed' : 'FAILURES');
  if (!ok) process.exit(1);
}
