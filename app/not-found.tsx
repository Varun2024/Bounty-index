import Link from 'next/link';

export const metadata = {
  title: '404 · Bounty Index',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="max-w-[600px] mx-auto px-6 py-24 text-center">
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">// route not found</p>
      <h1 className="text-5xl font-semibold tracking-tight text-neutral-50">404</h1>
      <p className="mt-4 text-sm text-neutral-400 leading-relaxed">
        No such route. We looked. It&rsquo;s not here.
        <br />
        <span className="text-neutral-500">
          The bug is probably in the URL, not in scope.
        </span>
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/programs"
          className="mono text-sm px-4 py-2 border border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300 rounded-md hover:border-emerald-400/70 hover:bg-emerald-400/[0.14] transition focus-ring inline-flex items-center gap-2"
        >
          /programs — always exists →
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
