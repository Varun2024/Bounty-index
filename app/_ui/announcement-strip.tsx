'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { activeAnnouncements, type Announcement } from '@/lib/announcements';

// Top strip for product news. Shows the newest active announcement the viewer
// hasn't dismissed; dismissing reveals the next one, then nothing. Dismissals
// are per-browser (localStorage), no account needed. Mirrors RestoredBanner.

const STORAGE_KEY = 'bi:dismissed-announcements';

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function pickNext(dismissed: string[]): Announcement | null {
  return activeAnnouncements().find((a) => !dismissed.includes(a.id)) ?? null;
}

export function AnnouncementStrip() {
  const [current, setCurrent] = useState<Announcement | null>(null);

  useEffect(() => {
    const next = pickNext(readDismissed());
    if (!next) return;
    // Deferred so the reveal stays client-only (no hydration flash).
    const id = requestAnimationFrame(() => setCurrent(next));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!current) return null;

  const dismiss = () => {
    const dismissed = readDismissed();
    if (!dismissed.includes(current.id)) {
      dismissed.push(current.id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
      } catch {
        // Private mode / blocked storage: it just won't persist across reloads.
      }
    }
    setCurrent(pickNext(dismissed));
  };

  return (
    <div className="border-b border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-2 text-xs md:text-sm flex items-center gap-2.5">
        <span
          aria-hidden
          className="mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-emerald-400/40 text-emerald-300 shrink-0"
        >
          new
        </span>
        <span className="flex-1 min-w-0">
          {current.message}{' '}
          <Link
            href={current.href}
            className="underline underline-offset-2 hover:text-emerald-100 whitespace-nowrap"
          >
            {current.cta}
          </Link>
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 text-emerald-300/70 hover:text-emerald-100 transition px-1 focus-ring rounded"
        >
          ×
        </button>
      </div>
    </div>
  );
}
