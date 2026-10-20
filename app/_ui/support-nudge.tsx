'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';

// A humble, dismissible corner nudge. Fires on desktop exit-intent (mouse leaving toward the tab
// bar) once the visitor has stuck around a bit, with a time fallback so touch devices get it too.
// Shown at most once every few days; much longer if they engage. Never blocks, always easy to dismiss.
const KEY = 'bi:support-nudge';
const DISMISS_DAYS = 3;
const ENGAGED_DAYS = 180;
const ARM_DELAY_MS = 20_000; // don't arm exit-intent for the first 20s (ignore quick bounces)
const FALLBACK_MS = 90_000; // no-exit-intent fallback (mobile, or a patient desktop reader)
const COFFEE_URL = 'https://buymeacoffee.com/varun_builds';
const REPO_URL = 'https://github.com/Varun2024/Bounty-index';

function suppressedUntilNow(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const { until } = JSON.parse(raw) as { until?: number };
    return typeof until === 'number' && Date.now() < until;
  } catch {
    return false;
  }
}

function remember(days: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ until: Date.now() + days * 86_400_000 }));
  } catch {
    // Blocked storage: the nudge may show again next session, which is acceptable.
  }
}

export function SupportNudge() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the slide-in transition

  useEffect(() => {
    if (suppressedUntilNow()) return;
    let armed = false;
    let fired = false;

    const reveal = () => {
      if (fired) return;
      fired = true;
      setOpen(true);
      remember(DISMISS_DAYS); // cap re-show even if they never interact
    };

    const armTimer = window.setTimeout(() => {
      armed = true;
    }, ARM_DELAY_MS);
    const fallbackTimer = window.setTimeout(reveal, FALLBACK_MS);

    const onMouseOut = (e: MouseEvent) => {
      // Exit-intent: cursor left through the top of the viewport and the window entirely.
      if (armed && e.clientY <= 0 && !e.relatedTarget) reveal();
    };
    document.addEventListener('mouseout', onMouseOut);

    return () => {
      window.clearTimeout(armTimer);
      window.clearTimeout(fallbackTimer);
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, []);

  // Trigger the slide-in one frame after mount.
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Esc dismisses (convenience; it's non-modal so focus isn't trapped).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss(DISMISS_DAYS);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function dismiss(days: number) {
    remember(days);
    setShown(false);
    window.setTimeout(() => setOpen(false), 200);
  }

  if (!open) return null;
  const authed = status === 'authenticated';

  return (
    <div
      role="region"
      aria-label="Support bounty.index"
      className={`fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] transition-all duration-200 ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="rounded-xl border border-neutral-800 bg-background shadow-[0_20px_60px_-16px_rgba(0,0,0,0.8)] p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-neutral-100">
            Still here? <span aria-hidden>☕</span>
          </p>
          <button
            type="button"
            onClick={() => dismiss(DISMISS_DAYS)}
            aria-label="Dismiss"
            className="shrink-0 -mt-0.5 h-6 w-6 inline-flex items-center justify-center rounded text-neutral-500 hover:text-neutral-200 transition focus-ring"
          >
            <svg aria-hidden viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <p className="mt-1.5 text-sm text-neutral-400 leading-relaxed">
          {authed
            ? 'Glad you’re using it. This runs on one person and a Neon bill, and a coffee goes straight to the server. No pressure, the index stays free.'
            : 'This is one person and a Neon bill. If the index saved you time, a coffee keeps it caffeinated. Or sign in to sync your watchlist (GitHub, no email, we can’t spam you). Free either way.'}
        </p>

        <a
          href={COFFEE_URL}
          target="_blank"
          rel="noreferrer noopener"
          onClick={() => remember(ENGAGED_DAYS)}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 mono text-sm px-4 py-2 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition focus-ring"
        >
          <span aria-hidden>☕</span> buy me a coffee
        </a>

        <div className="mt-2.5 flex items-center justify-center gap-3 mono text-[11px] text-neutral-500">
          {!authed && (
            <>
              <button
                type="button"
                onClick={() => {
                  remember(ENGAGED_DAYS);
                  void signIn('github');
                }}
                className="focus-ring rounded underline decoration-neutral-700 underline-offset-4 hover:text-emerald-300 hover:decoration-emerald-400 transition"
              >
                sign in to sync
              </button>
              <span className="text-neutral-700">·</span>
            </>
          )}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => remember(ENGAGED_DAYS)}
            className="focus-ring rounded underline decoration-neutral-700 underline-offset-4 hover:text-emerald-300 hover:decoration-emerald-400 transition"
          >
            star on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
