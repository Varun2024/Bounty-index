import { Skeleton } from '@/app/_ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className="route-bar" />
      <div className="max-w-[1400px] mx-auto px-6 py-10 grid grid-cols-[248px_1fr] gap-10">
        <aside className="space-y-6">
          <Skeleton className="h-9 w-full" />
          {['Platform', 'Asset type', 'Min reward', 'Program', 'Sort'].map((label) => (
            <div key={label}>
              <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-16" />
                ))}
              </div>
            </div>
          ))}
        </aside>
        <section>
          <div className="flex items-end justify-between mb-8">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-40" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
            <div className="h-11 border-b border-neutral-900 bg-neutral-950/60" />
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_180px_120px_120px] items-center px-5 py-4 border-b border-neutral-900 last:border-b-0 gap-6">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-14 ml-auto" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
