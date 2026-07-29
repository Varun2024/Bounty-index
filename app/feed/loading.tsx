import { Skeleton } from '@/app/_ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className="route-bar" />
      <div className="max-w-[1000px] mx-auto px-6 py-10">
        <div className="flex items-end justify-between border-b border-neutral-900 pb-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-7 w-16" />
        </div>
        <div className="mt-10 grid grid-cols-[92px_1fr] gap-6">
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16 mt-2" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
