'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[route-error]', error);
  }, [error]);

  return (
    <div className="max-w-[600px] mx-auto px-6 py-24 text-center">
      <p className="mono text-[10px] uppercase tracking-widest text-amber-400/80 mb-3">// something broke</p>
      <h1 className="text-5xl font-semibold tracking-tight text-neutral-50">500</h1>
      <p className="mt-4 text-sm text-neutral-400 leading-relaxed">
        This page tripped on the way up. Not your fault.
        <br />
        <span className="text-neutral-500">
          Reported. Try again, or head somewhere that still works.
        </span>
      </p>
      {error.digest && (
        <p className="mt-4 mono text-[10px] text-neutral-600 tracking-widest">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="mono text-sm px-4 py-2 border border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300 rounded-md hover:border-emerald-400/70 hover:bg-emerald-400/[0.14] transition focus-ring"
        >
          retry →
        </button>
        <Link
          href="/programs"
          className="mono text-sm px-4 py-2 border border-neutral-800 rounded-md text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900 transition focus-ring"
        >
          /programs
        </Link>
        <Link
          href="/"
          className="mono text-sm px-4 py-2 border border-neutral-800 rounded-md text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900 transition focus-ring"
        >
          home
        </Link>
      </div>
    </div>
  );
}
