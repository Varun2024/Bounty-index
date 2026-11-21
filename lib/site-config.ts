import { z } from 'zod';
import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appConfig } from '@/lib/db/schema';

// Admin-editable site config: the announcement strip, the two nudges' timing/caps, and the
// degraded/restored banner copy. Stored as one JSONB row (key='ui'); read cached on the hot
// layout path and invalidated by tag on write (app/actions/site-config.ts). On any read or
// validation failure we fall back to DEFAULT_SITE_CONFIG so the layout never breaks.

export const CONFIG_KEY = 'ui';
export const SITE_CONFIG_TAG = 'site-config';

export const announcementSchema = z.object({
  id: z.string().min(1).max(80), // stable slug; drives per-browser dismissal, never reuse
  message: z.string().min(1).max(300),
  href: z.string().min(1).max(300),
  cta: z.string().min(1).max(80),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type Announcement = z.infer<typeof announcementSchema>;

const feedbackNudgeSchema = z.object({
  showAfterSec: z.number().int().min(0).max(600),
  dismissDays: z.number().int().min(0).max(365),
  engagedDays: z.number().int().min(0).max(365),
});
export type FeedbackNudgeConfig = z.infer<typeof feedbackNudgeSchema>;

const supportNudgeSchema = z.object({
  armDelaySec: z.number().int().min(0).max(600),
  fallbackSec: z.number().int().min(0).max(600),
  dismissDays: z.number().int().min(0).max(365),
  engagedDays: z.number().int().min(0).max(365),
});
export type SupportNudgeConfig = z.infer<typeof supportNudgeSchema>;

const degradedBannerSchema = z.object({
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(400),
});
export type DegradedBannerConfig = z.infer<typeof degradedBannerSchema>;

const restoredBannerSchema = z.object({
  id: z.string().min(1).max(80), // bump to force a re-show after a new incident
  enabled: z.boolean(),
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(400),
  hideAfter: z.string().datetime(), // auto-hide at/after this, regardless of dismissal
});
export type RestoredBannerConfig = z.infer<typeof restoredBannerSchema>;

export const siteConfigSchema = z.object({
  announcements: z.array(announcementSchema).max(20),
  feedbackNudge: feedbackNudgeSchema,
  supportNudge: supportNudgeSchema,
  degradedBanner: degradedBannerSchema,
  restoredBanner: restoredBannerSchema,
});
export type SiteConfig = z.infer<typeof siteConfigSchema>;

// Seeded from the values that were hardcoded in the components before this moved to config.
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  announcements: [
    {
      id: 'discord-alerts-2026-10',
      message: 'New: get scope and reward changes pushed straight into your Discord.',
      href: '/settings/discord',
      cta: 'Set up alerts →',
      startsAt: '2026-10-27T00:00:00Z',
      expiresAt: '2026-11-10T00:00:00Z',
    },
    {
      id: 'hackenproof-2026-10',
      message: 'New platform: HackenProof programs are now in the index.',
      href: '/platforms/hackenproof',
      cta: 'Browse HackenProof →',
      startsAt: '2026-10-26T00:00:00Z',
      expiresAt: '2026-11-09T00:00:00Z',
    },
  ],
  feedbackNudge: { showAfterSec: 40, dismissDays: 7, engagedDays: 14 },
  supportNudge: { armDelaySec: 20, fallbackSec: 90, dismissDays: 3, engagedDays: 180 },
  degradedBanner: {
    title: 'Live data paused.',
    message: 'Neon is grumpy. Programs still load from the upstream mirror; watchlists and alerts are taking a nap.',
  },
  restoredBanner: {
    id: 'auth-restored-2026-10-14',
    enabled: false, // the Oct 2026 incident is over; off by default until the next one
    title: 'Services restored.',
    message: 'Logins, watchlists, Discord alerts and saved filters are back on. Go hunt.',
    hideAfter: '2026-10-21T00:00:00Z',
  },
};

// Active = within [startsAt, expiresAt), newest first.
export function activeAnnouncements(config: SiteConfig, now: Date = new Date()): Announcement[] {
  const t = now.getTime();
  return config.announcements
    .filter((a) => {
      const s = new Date(a.startsAt).getTime();
      const e = new Date(a.expiresAt).getTime();
      return t >= s && t < e;
    })
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
}

const loadConfig = unstable_cache(
  async (): Promise<SiteConfig> => {
    try {
      const [row] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, CONFIG_KEY));
      if (!row) return DEFAULT_SITE_CONFIG;
      const parsed = siteConfigSchema.safeParse(row.value);
      return parsed.success ? parsed.data : DEFAULT_SITE_CONFIG;
    } catch {
      return DEFAULT_SITE_CONFIG; // DB down → defaults, never break the layout
    }
  },
  ['site-config'],
  { tags: [SITE_CONFIG_TAG], revalidate: 300 },
);

export function getSiteConfig(): Promise<SiteConfig> {
  return loadConfig();
}
