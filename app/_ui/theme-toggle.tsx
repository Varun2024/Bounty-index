'use client';

import { useEffect, useState } from 'react';

type Resolved = 'light' | 'dark';

function resolveCurrent(): Resolved {
  const root = document.documentElement;
  if (root.classList.contains('light')) return 'light';
  if (root.classList.contains('dark')) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    setResolved(resolveCurrent());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const root = document.documentElement;
      if (!root.classList.contains('light') && !root.classList.contains('dark')) {
        setResolved(mq.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    const next: Resolved = resolveCurrent() === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
    setResolved(next);
  }

  const label = resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="focus-ring inline-flex items-center justify-center w-8 h-8 rounded-md border border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-emerald-300 hover:border-neutral-600 transition"
    >
      {resolved === null ? (
        <span className="w-3.5 h-3.5" aria-hidden />
      ) : resolved === 'dark' ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a7.5 7.5 0 1 0 11 11Z" />
    </svg>
  );
}
