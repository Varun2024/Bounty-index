import Image from 'next/image';

// Shown while the scope lookup runs: Fuzz is on the scent.
export default function Loading() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-24 text-center">
      <Image
        src="/fuzz-hunt.png"
        alt=""
        width={160}
        height={160}
        priority
        className="mx-auto w-36 h-36 opacity-90"
      />
      <p className="mono text-[11px] uppercase tracking-widest text-neutral-500 mt-4">{'// on the scent…'}</p>
      <p className="text-sm text-neutral-400 mt-2">Fuzz is checking every program&rsquo;s scope.</p>
    </div>
  );
}
