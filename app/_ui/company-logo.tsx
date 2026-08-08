'use client';

import { useState } from 'react';

interface CompanyLogoProps {
  domain: string | null;
  name: string;
  size?: number;
  className?: string;
}

// Renders the company favicon at ~2x the display size for crispness, with a monogram
// fallback rendered inline if the favicon 404s or comes back as Google's default globe.
// Google's s2/favicons API is free, reliable, and doesn't need an API key.
export function CompanyLogo({ domain, name, size = 44, className = '' }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  const initial = name.replace(/^the\s+/i, '').charAt(0).toUpperCase();
  const monoBox = (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 mono text-neutral-300 font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );

  if (!domain || failed) return monoBox;

  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`rounded-lg border border-neutral-800 bg-neutral-950 object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
