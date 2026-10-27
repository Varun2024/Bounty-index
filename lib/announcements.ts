// Product announcements shown in the top strip (app/_ui/announcement-strip.tsx).
// Distinct from /whats-new, which is the scope changelog (data changes). This is
// "we shipped X" product news: new coverage, new features, time-boxed.
//
// To publish: add an entry, newest first, set startsAt/expiresAt, deploy.
// To retire early: set expiresAt to the past, or delete the entry.
//
// ponytail: a hardcoded list, not a DB table + admin UI. Announcements ship a few
// times a month and each one is a deploy anyway. Move to a table only if a
// non-deploying editor ever needs to post one.

export interface Announcement {
  id: string; // stable slug; drives per-browser dismissal, so never reuse one
  message: string; // one short line, no hype
  href: string; // internal path the CTA links to
  cta: string; // link label
  startsAt: string; // ISO; strip appears at/after this
  expiresAt: string; // ISO; strip stops at this
}

// Newest first.
export const ANNOUNCEMENTS: Announcement[] = [
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
];

// Active = within [startsAt, expiresAt), newest first.
export function activeAnnouncements(now: Date = new Date()): Announcement[] {
  const t = now.getTime();
  return ANNOUNCEMENTS.filter((a) => {
    const s = new Date(a.startsAt).getTime();
    const e = new Date(a.expiresAt).getTime();
    return t >= s && t < e;
  }).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
}
