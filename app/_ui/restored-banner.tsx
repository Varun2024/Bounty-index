'use client';

import { useEffect, useState } from 'react';
import type { RestoredBannerConfig } from '@/lib/site-config';

// Service-restored strip (shown after an incident). Dismissible per-browser via localStorage;
// auto-hides after `hideAfter` regardless. All of it — enabled, id, copy, hideAfter — is
// admin-editable; bump `id` to force a re-show for a new incident.

export function RestoredBanner({ id: BANNER_ID, enabled, title, message, hideAfter }: RestoredBannerConfig) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled || Date.now() > new Date(hideAfter).getTime()) return;
    try {
      if (localStorage.getItem(BANNER_ID) === 'dismissed') return;
    } catch {
      // Private mode / blocked storage: show anyway, dismissal just won't persist.
    }
    // Deferred so it isn't a synchronous setState in the effect body (keeps client-only reveal).
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, [enabled, hideAfter, BANNER_ID]);

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
          <strong className="font-medium">{title}</strong>{' '}
          {message}
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
