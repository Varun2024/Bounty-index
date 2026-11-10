'use client';

import { useEffect, useState } from 'react';

// A quiet, dismissible reminder pinned under the navbar (top-right) that points at the feedback
// form. Separate from the always-present feedback edge tab: the tab is a standing offer, this is
// an occasional prompt. It opens the existing FeedbackDialog by dispatching OPEN_FEEDBACK, so the
// dialog keeps owning its own state. Shown at most once every couple of weeks, and not at all once
// the visitor has already opened feedback (that's tracked by the dialog's own seen key).
const KEY = 'bi:feedback-nudge';
const SEEN_KEY = 'bi:feedback-seen'; // set by the dialog once it's been opened; suppresses this nudge
const OPEN_FEEDBACK = 'bi:open-feedback';
const DISMISS_DAYS = 7; // rarer than the support nudge (3d): this is the secondary ask
const ENGAGED_DAYS = 14; // they opened feedback from here, so back off for a couple of weeks
const SHOW_AFTER_MS = 40_000; // let them actually read the page first; no exit-intent (coffee owns that)

function suppressed(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return true; // already found feedback some other way
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

export function FeedbackNudge() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the slide-in transition

  useEffect(() => {
    if (suppressed()) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      remember(DISMISS_DAYS); // cap re-show even if they never interact
    }, SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Trigger the slide-in one frame after mount.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Esc dismisses (it's non-modal, so focus isn't trapped).
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

  function openFeedback() {
    remember(ENGAGED_DAYS);
    setShown(false);
    window.setTimeout(() => setOpen(false), 200);
    window.dispatchEvent(new Event(OPEN_FEEDBACK));
  }

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Send feedback"
      className={`fixed right-4 z-30 w-[min(21rem,calc(100vw-2rem))] transition-all duration-200 ease-out ${
        shown ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
      style={{ top: 'calc(3.5rem + env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="rounded-xl border border-neutral-800 bg-background shadow-[0_20px_60px_-16px_rgba(0,0,0,0.8)] p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-neutral-100">Something off?</p>
          <button
            type="button"
            onClick={() => dismiss(DISMISS_DAYS)}
            aria-label="Dismiss"
            className="shrink-0 -mt-0.5 h-6 w-6 inline-flex items-center justify-center rounded text-neutral-400 hover:text-neutral-200 transition focus-ring"
          >
            <svg aria-hidden viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <p className="mt-1.5 text-sm text-neutral-400 leading-relaxed">
          Something slow, broken, or missing? Send me a note, I read every one. A quick GitHub
          sign-in lets me reply and keeps the spam out.
        </p>

        <button
          type="button"
          onClick={openFeedback}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 mono text-sm px-4 py-2 border border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300 rounded-md hover:bg-emerald-400/[0.12] hover:border-emerald-400/60 transition focus-ring"
        >
          send feedback
        </button>
      </div>
    </div>
  );
}
