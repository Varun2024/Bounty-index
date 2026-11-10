'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

// Fuzz pops into the bottom-left corner every few minutes with a short word of encouragement,
// then slips away on its own. Dismissible, non-blocking, and still under prefers-reduced-motion
// (it just fades instead of sliding). Not a nag: long gaps, and it never covers anything.

// Hunter-flavored encouragement. Kept genuine and specific, no buzzwords, no em dashes.
const LINES = [
  'Recon pays. Map the scope before you poke it.',
  'The boring programs have the lonely bugs.',
  'Read the policy twice. Dupes hide in the fine print.',
  'Low-hanging fruit is gone. Go one subdomain deeper.',
  'A small bug reported well beats a big one reported badly.',
  'Scope moved today. Someone is already looking. Be first.',
  'Chain the mediums. Impact adds up.',
  'New program, smaller crowd. Worth a look.',
  'Tired eyes miss bugs. Save a filter, come back sharp.',
  'The best bug is the one nobody filtered for.',
  'Out of scope is a trap, not a dare. Respect it.',
  'Came up empty? That is recon, not failure. Next target.',
];

const FIRST_DELAY_MS = 60_000; // let people settle in before the first one
const VISIBLE_MS = 9_000;
const GAP_MIN_MS = 180_000; // 3 min
const GAP_MAX_MS = 360_000; // 6 min

function randomGap(): number {
  return GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS);
}

export function FuzzWhisper() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the fade/slide
  const [line, setLine] = useState('');
  const lastIndex = useRef(-1);
  const timers = useRef<number[]>([]);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  function scheduleNext(delay: number) {
    const t = window.setTimeout(reveal, delay);
    timers.current.push(t);
  }

  function reveal() {
    // Pick a line that isn't the one we just showed.
    let i = Math.floor(Math.random() * LINES.length);
    if (LINES.length > 1 && i === lastIndex.current) i = (i + 1) % LINES.length;
    lastIndex.current = i;
    setLine(LINES[i]);
    setOpen(true);
    const hideT = window.setTimeout(() => hide(randomGap()), VISIBLE_MS);
    timers.current.push(hideT);
  }

  function hide(nextDelay: number | null) {
    setShown(false);
    const t = window.setTimeout(() => {
      setOpen(false);
      if (nextDelay != null) scheduleNext(nextDelay);
    }, 220);
    timers.current.push(t);
  }

  // Kick off the loop.
  useEffect(() => {
    scheduleNext(FIRST_DELAY_MS);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade/slide in one frame after it mounts.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-4 z-40 flex items-end gap-2 w-[min(20rem,calc(100vw-2rem))] transition-all duration-200 ease-out motion-reduce:transition-opacity ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 motion-reduce:translate-y-0'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Image
        src="/fuzz.png"
        alt=""
        width={56}
        height={56}
        className="shrink-0 w-14 h-14 select-none"
        draggable={false}
      />
      <div className="relative flex-1 rounded-xl rounded-bl-sm border border-neutral-800 bg-background shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)] px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => hide(randomGap())}
          aria-label="Dismiss"
          className="absolute top-1 right-1 h-6 w-6 inline-flex items-center justify-center rounded text-neutral-400 hover:text-neutral-200 transition focus-ring"
        >
          <svg aria-hidden viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="mono text-[10px] uppercase tracking-widest text-emerald-400/90">Fuzz says</p>
        <p className="mt-1 text-sm text-neutral-200 leading-snug pr-4">{line}</p>
      </div>
    </div>
  );
}
