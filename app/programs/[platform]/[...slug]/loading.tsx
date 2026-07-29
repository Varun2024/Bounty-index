import { Skeleton } from '@/app/_ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className="route-bar" />
      <div className="border-b border-neutral-900">
        <div className="max-w-[1100px] mx-auto px-6 py-4">
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <section className="border-b border-neutral-900 pb-8">
          <Skeleton className="h-10 w-72" />
          <div className="mt-4 flex gap-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="mt-5 flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16" />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          {[0, 1].map((col) => (
            <div key={col}>
              <Skeleton className="h-3 w-24 mb-3" />
              <div className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-900 last:border-b-0">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
