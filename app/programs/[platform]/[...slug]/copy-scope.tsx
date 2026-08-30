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
      className="mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-emerald-300 transition"
      title="Copy all in-scope identifiers (newline-separated)"
    >
      {copied ? `✓ copied ${identifiers.length}` : `copy ${identifiers.length}`}
    </button>
  );
}
