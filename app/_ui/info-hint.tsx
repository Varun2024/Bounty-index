import type { ReactNode } from 'react';

interface InfoHintProps {
  label: string; // accessible name for the trigger (what the hint is about)
  children: ReactNode; // the hint body
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
}

// A small (i) that reveals its explanation on hover/focus, so meta/disclaimer microcopy stays off
// the layout instead of spending a full line (the Vercel pattern). CSS-only, server-renderable, and
// keyboard-reachable via the button; the tooltip shows on :hover or :focus-within.
export function InfoHint({ label, children, side = 'top', align = 'center' }: InfoHintProps) {
  return (
    <span className="info-hint">
      <button type="button" className="info-hint__btn focus-ring" aria-label={label}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="8" cy="8" r="6.4" />
          <path d="M8 7.3v3.4" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.85" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span role="tooltip" className={`info-hint__pop info-hint__pop--${side} info-hint__pop--${align}`}>
        {children}
      </span>
    </span>
  );
}
