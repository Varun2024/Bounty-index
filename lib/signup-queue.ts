import { put, list, del } from '@vercel/blob';

// Vercel Blob queue for OAuth signups that arrive while the DB is unreachable.
// Each entry is a JSON object under prefix `pending-signups/`. When the DB is back,
// admin can replay them (or delete stale ones).
//
// ponytail: JSON per file, listed by prefix. Tiny volume expected (~outage-length x new
// signups). If it ever grows past a few hundred, switch to a single append-only NDJSON blob.

const PREFIX = 'pending-signups/';

export interface PendingSignup {
  githubId: string;
  handle: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
  reason: string;
  attemptedAt: string;
}

export interface StoredPendingSignup extends PendingSignup {
  key: string;
  url: string;
}

function safeGithubId(raw: unknown): string {
  const s = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : 'unknown';
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export async function enqueueSignup(entry: PendingSignup): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return; // no blob configured, silently no-op
  const id = safeGithubId(entry.githubId);
  const key = `${PREFIX}${id}-${Date.now()}.json`;
  try {
    // ponytail: 'public' access — the file URL is unlisted (prefixed dir + random suffix)
    // and only referenced from the admin page. Private-only stores would need signed
    // URLs to read back; not worth the complexity for this queue.
    await put(key, JSON.stringify(entry, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true,
      allowOverwrite: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  } catch (err) {
    // Surface on server logs so a broken Blob config doesn't fail silently.
    console.error('[signup-queue] enqueue failed:', err instanceof Error ? err.message : err);
    throw err;
  }
}

export async function listPendingSignups(): Promise<StoredPendingSignup[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const { blobs } = await list({ prefix: PREFIX, limit: 200, token: process.env.BLOB_READ_WRITE_TOKEN });
  const out: StoredPendingSignup[] = [];
  for (const b of blobs) {
    try {
      const res = await fetch(b.url);
      if (!res.ok) continue;
      const parsed = (await res.json()) as PendingSignup;
      out.push({ ...parsed, key: b.pathname, url: b.url });
    } catch {
      // skip unreadable
    }
  }
  return out.sort((a, b) => (a.attemptedAt < b.attemptedAt ? 1 : -1));
}

export async function deletePendingSignup(key: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
}
