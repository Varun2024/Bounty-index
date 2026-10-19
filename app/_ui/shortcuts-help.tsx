'use client';

import { useEffect, useRef, useState } from 'react';

// Only real, wired shortcuts (see global-keyboard.tsx, command-palette.tsx, keyboard-nav.tsx).
// No invented keys.
interface Row {
  keys: string[];
  alt?: string[];
  label: string;
}

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Anywhere',
    rows: [
      { keys: ['⌘', 'K'], alt: ['Ctrl', 'K'], label: 'Open the command menu' },
      { keys: ['/'], label: 'Jump to search' },
      { keys: ['?'], label: 'Show this help' },
    ],
  },
  {
    title: 'Programs list',
    rows: [
      { keys: ['j'], alt: ['↓'], label: 'Next program' },
      { keys: ['k'], alt: ['↑'], label: 'Previous program' },
      { keys: ['↵'], label: 'Open the highlighted program' },
      { keys: ['esc'], label: 'Clear focus' },
    ],
  },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="mono text-[11px] min-w-[1.5rem] h-6 px-1.5 inline-flex items-center justify-center border border-neutral-800 rounded bg-neutral-900/80 text-neutral-300"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // `?` opens from anywhere; the command palette also opens it via a custom event.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inField = t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable;
      if (e.key === '?' && !inField) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('shortcuts:open', onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('shortcuts:open', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div aria-hidden className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative w-full max-w-[480px] rounded-xl border border-neutral-800 bg-background shadow-[0_24px_80px_-16px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 h-13 py-4 border-b border-neutral-900">
          <h2 id="shortcuts-title" className="text-sm font-medium text-neutral-100">Keyboard shortcuts</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-neutral-500 hover:text-neutral-200 transition focus-ring rounded h-7 w-7 inline-flex items-center justify-center"
          >
            <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2.5">{section.title}</p>
              <ul className="space-y-2">
                {section.rows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-neutral-300">{row.label}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <Keys keys={row.keys} />
                      {row.alt && (
                        <>
                          <span className="text-neutral-600 text-xs">or</span>
                          <Keys keys={row.alt} />
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
