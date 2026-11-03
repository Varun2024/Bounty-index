import type { Metadata } from 'next';
import Link from 'next/link';

const CONTACT_EMAIL = 'varunshukla747@gmail.com';
const EFFECTIVE = 'November 2, 2026';

export const metadata: Metadata = {
  title: 'Terms · Bounty Index',
  description:
    'The plain-language terms for using bounty.index: the data, the API and MCP endpoint, accounts, and the usual no-warranty fine print. Free, no signup to browse.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <div className="border-b border-neutral-900 pb-6 reveal">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Terms · effective {EFFECTIVE}</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Terms of use</h1>
        <p className="text-neutral-400 mt-3 max-w-2xl leading-relaxed">
          The short, honest contract for using bounty.index. By using the site, the API, or the MCP endpoint, you agree to
          these. I&rsquo;ve kept them plain on purpose.
        </p>
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">What this is</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          bounty.index is a free index of public bug bounty programs, pulled together across seven platforms. Browsing is
          free and needs no account. Signing in with GitHub unlocks saved features like your watchlist, notes, and alerts.
          I build and run it solo.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">The data, and a real caveat</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          The program data is aggregated from public sources and refreshed daily, so it can lag or carry a mistake from
          upstream. Before you test anything, treat the official program page on the platform as the source of truth for
          scope, rules, and safe-harbor status. I do my best to keep this accurate, but I can&rsquo;t promise it is complete or
          current, and you are responsible for staying inside a program&rsquo;s actual rules. bounty.index is not permission to
          test anything.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">The API and MCP endpoint</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          The export endpoints and the MCP server are open for you to build on. Please be a good neighbor: don&rsquo;t hammer
          them hard enough to degrade the site for everyone else, and don&rsquo;t pass off the data as if it were your own
          original collection. The underlying program data mostly comes from the public{' '}
          <a href="https://github.com/arkadiyt/bounty-targets-data" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">bounty-targets-data</a>{' '}
          project and each platform; credit flows there. If your usage starts to threaten the site&rsquo;s stability, I may rate-limit or block it.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Your account</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          You&rsquo;re responsible for what happens under your GitHub sign-in. Keep it to one person, don&rsquo;t use the site to
          break the law or abuse the platforms it lists, and don&rsquo;t try to attack or overload the service itself. You can
          delete your account at any time, which removes your data (see the{' '}
          <Link href="/privacy" className="text-emerald-400 hover:underline">privacy page</Link>). I can suspend an account that abuses the service.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Not affiliated with the platforms</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          bounty.index is an independent project. It is not affiliated with, endorsed by, or operated by HackerOne, Bugcrowd,
          Intigriti, YesWeHack, Federacy, Immunefi, HackenProof, or any program listed. Their names and marks belong to them.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">No warranty, and the liability part</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          The site is provided as is, with no warranty of any kind. It&rsquo;s a free tool run by one person; it can go down,
          lag, or be wrong. To the extent the law allows, I&rsquo;m not liable for losses that come from using it or relying on
          its data, including anything that happens from testing a program. Verify on the platform, and test responsibly.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Changes</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          If these terms change, I&rsquo;ll update this page and move the effective date at the top. Keep using the site after a
          change and you&rsquo;re agreeing to the new version.
        </p>
      </section>

      <section className="mt-12 border-t border-neutral-900 pt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-neutral-400 leading-relaxed">
          Questions? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:underline">{CONTACT_EMAIL}</a>.
        </p>
        <Link href="/privacy" className="mono text-xs text-neutral-400 hover:text-emerald-400 transition">privacy →</Link>
      </section>
    </div>
  );
}
