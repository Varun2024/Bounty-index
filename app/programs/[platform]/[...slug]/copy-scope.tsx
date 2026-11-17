'use client';

import { useState } from 'react';

interface CopyScopeProps {
  identifiers: string[];
}

// Newline-separated in-scope identifiers. Paste-target-agnostic: works in Burp scope config,
// Caido, a text file, whatever. No format conversion — hunters know their tool better than we do.
export function CopyScope({ identifiers }: CopyScopeProps) {
  const [copied, setCopied] = useState(false);
  if (!identifiers.length) return null;

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(identifiers.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (Safari private mode etc.) — silently no-op.
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring mono text-xs px-3 py-2 border rounded-md inline-flex items-center gap-1.5 transition ${
        copied
          ? 'border-emerald-400/60 bg-emerald-400/[0.10] text-emerald-300'
          : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:text-emerald-300 hover:border-emerald-400/60 hover:bg-neutral-800'
      }`}
      title="Copy all in-scope identifiers, newline-separated, to paste into Burp, Caido, or a file"
    >
      <svg aria-hidden viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {copied ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </>
        )}
      </svg>
      {copied ? `copied ${identifiers.length}` : `copy ${identifiers.length} in scope`}
    </button>
  );
}
