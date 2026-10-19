'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// A thin top bar that starts the moment an internal link is clicked and finishes when the new
// route commits. Dynamic pages (watchlist, compare) do a server round-trip on navigation with no
// built-in feedback; this is the "you clicked, it's loading" signal. Click-driven so it fires on
// the click itself, not after the router commits (which is the delay we're covering).
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const activeRef = useRef(false);
  const trickleRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const firstRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (trickleRef.current !== null) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const start = useCallback(() => {
    clearTimers();
    activeRef.current = true;
    setVisible(true);
    setWidth(8);
    // Trickle toward 90% so a slow route still shows forward motion.
    trickleRef.current = window.setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
    }, 200);
  }, [clearTimers]);

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    if (trickleRef.current !== null) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    setWidth(100);
    timersRef.current.push(
      window.setTimeout(() => setVisible(false), 220),
      window.setTimeout(() => setWidth(0), 480),
    );
  }, []);

  // Start on a left-click of an internal link that actually navigates.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      const target = anchor.getAttribute('target');
      if (!href || target === '_blank' || anchor.hasAttribute('download')) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page
      start();
    }
    // Capture phase so it runs before the router intercepts the click.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [start]);

  // Route committed: finish. Deferred out of the effect body so it isn't a synchronous setState.
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    const t = window.setTimeout(() => finish(), 0);
    return () => clearTimeout(t);
  }, [pathname, searchParams, finish]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 h-[2px] z-[60] bg-emerald-400 shadow-[0_0_8px_0] shadow-emerald-400/60 pointer-events-none transition-[width,opacity] duration-200 ease-out"
      style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
    />
  );
}
