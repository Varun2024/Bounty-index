'use client';

import { useEffect, useState } from 'react';

const KEY = 'bi:kbd-hint-dismissed';

export function KeyboardHintBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(KEY) === '1') return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch {}
    setVisible(false);
  };

  return (
    <div className="mb-4 border border-neutral-900 bg-neutral-950/60 rounded-lg px-4 py-2.5 flex items-center justify-between gap-4 reveal">
      <p className="mono text-[11px] text-neutral-400 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-neutral-500 uppercase tracking-widest text-[10px]">keyboard</span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-300">/</kbd>
          <span className="text-neutral-500">search</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-300">j</kbd>
          <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-300">k</kbd>
          <span className="text-neutral-500">navigate</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-300">↵</kbd>
          <span className="text-neutral-500">open</span>
        </span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition focus-ring rounded px-2 py-1 shrink-0"
        aria-label="Dismiss keyboard hint"
      >
        dismiss
      </button>
    </div>
  );
}
