'use client';

import { useEffect, useState } from 'react';

// Service-restored strip shown after the Oct 2026 Neon storage outage.
// Dismissible per-browser via localStorage; auto-hides after HIDE_AFTER regardless.
// Bump BANNER_ID to force a re-show for a future incident.

const BANNER_ID = 'auth-restored-2026-10-14';
const HIDE_AFTER = new Date('2026-10-21T00:00:00Z'); // 7 days

export function RestoredBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Date.now() > HIDE_AFTER.getTime()) return;
    try {
      if (localStorage.getItem(BANNER_ID) === 'dismissed') return;
    } catch {
      // Private mode / blocked storage: show anyway, dismissal just won't persist.
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(BANNER_ID, 'dismissed');
    } catch {}
  };

  return (
    <div className="border-b border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-2 text-xs md:text-sm flex items-center gap-2">
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="flex-1">
          <strong className="font-medium">Services restored.</strong>{' '}
          Logins, watchlists, Discord alerts and saved filters are back on — go hunt.
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-emerald-300/70 hover:text-emerald-100 transition px-1 focus-ring rounded"
        >
          ×
        </button>
      </div>
    </div>
  );
}
