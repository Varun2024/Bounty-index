'use client';

import { useFormStatus } from 'react-dom';

export function CheckButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="cta-arrow focus-ring mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition shadow-[0_0_40px_-10px] shadow-emerald-400/70 disabled:opacity-70 disabled:cursor-wait inline-flex items-center gap-2"
    >
      {pending ? (
        <>
          <Spinner />
          <span>checking</span>
        </>
      ) : (
        <>
          check <span className="arrow">→</span>
        </>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
