'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from './require-user';
import { createMcpToken, listMcpTokens, revokeMcpToken, type TokenRow } from '@/lib/mcp-tokens';

export interface CreateTokenResult {
  ok: boolean;
  token?: string; // plaintext, returned once
  error?: string;
}

export async function createTokenAction(label?: string): Promise<CreateTokenResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'Sign in required.' };
  try {
    const { token } = await createMcpToken(userId, label);
    revalidatePath('/settings/mcp');
    return { ok: true, token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not create token.' };
  }
}

export async function revokeTokenAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'Sign in required.' };
  const ok = await revokeMcpToken(userId, id);
  revalidatePath('/settings/mcp');
  return ok ? { ok: true } : { ok: false, error: 'Token not found or already revoked.' };
}

export async function listTokensAction(): Promise<TokenRow[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  return listMcpTokens(userId);
}

export interface SerializedToken {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

// Client-friendly listing (Dates as ISO strings). Used by the page and to refresh after mutations.
export async function getMyTokens(): Promise<SerializedToken[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const rows = await listMcpTokens(userId);
  return rows.map((t) => ({
    id: t.id,
    label: t.label,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  }));
}
