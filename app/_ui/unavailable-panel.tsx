export function UnavailablePanel({ what }: { what: string }) {
  return (
    <div className="border border-amber-500/25 rounded-lg p-8 bg-amber-500/[0.04] text-center">
      <p className="mono text-[10px] uppercase tracking-widest text-amber-400 mb-2">
        Temporarily unavailable
      </p>
      <p className="text-sm text-neutral-300">{what} paused during a database outage.</p>
      <p className="mt-2 text-xs text-neutral-500">
        Existing subscriptions and data are safe. Reload in a few minutes.
      </p>
    </div>
  );
}
