import { Skeleton } from '@/app/_ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className="route-bar" />
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <Skeleton className="h-3 w-16 mb-2" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-96 mt-3" />
        <div className="mt-8 flex gap-2 max-w-xl">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 w-24" />
        </div>
        <div className="mt-10">
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <div className="mt-8 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}
