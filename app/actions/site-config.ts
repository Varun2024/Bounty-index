'use server';

import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { db } from '@/lib/db/client';
import { appConfig } from '@/lib/db/schema';
import { siteConfigSchema, CONFIG_KEY, SITE_CONFIG_TAG } from '@/lib/site-config';

type Result = { ok: true } | { ok: false; error: string };

// Save the whole site config. Admin-only, strictly validated. On success the cache tag is
// revalidated so the layout picks up the change on the next render.
export async function updateSiteConfig(input: unknown): Promise<Result> {
  const session = await auth();
  if (!isAdmin(session)) return { ok: false, error: 'not authorized' };

  const parsed = siteConfigSchema.safeParse(input);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i ? `${i.path.join('.') || 'config'}: ${i.message}` : 'invalid config' };
  }
  const cfg = parsed.data;

  // Announcement ids are dismissal keys: must be unique, or dismissing one hides another.
  const ids = cfg.announcements.map((a) => a.id);
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'announcement ids must be unique' };

  // Links go into <Link href>; only allow internal paths or https (blocks javascript:/data:/protocol-relative).
  const bad = cfg.announcements.find((a) => !/^\/(?!\/)/.test(a.href) && !/^https:\/\//i.test(a.href));
  if (bad) return { ok: false, error: `href must be an internal path (/...) or https:// — got "${bad.href}"` };

  // startsAt must be before expiresAt, or the strip never shows.
  const inverted = cfg.announcements.find((a) => Date.parse(a.startsAt) >= Date.parse(a.expiresAt));
  if (inverted) return { ok: false, error: `announcement "${inverted.id}": startsAt must be before expiresAt` };

  try {
    await db
      .insert(appConfig)
      .values({ key: CONFIG_KEY, value: cfg, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appConfig.key, set: { value: cfg, updatedAt: new Date() } });
    revalidateTag(SITE_CONFIG_TAG, 'default');
    return { ok: true };
  } catch {
    return { ok: false, error: 'could not save (DB error)' };
  }
}
