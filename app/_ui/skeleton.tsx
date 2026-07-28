export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 bg-[length:200%_100%] animate-[shimmer_1.6s_ease-in-out_infinite] ${className}`}
    />
  );
}
