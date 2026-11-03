import type { Metadata } from 'next';
import Link from 'next/link';

// Static page, no dynamic data. Keep the contact address in one place so it is
// trivial to change, and so the mailto and the body never drift apart.
const CONTACT_EMAIL = 'varunshukla747@gmail.com';
const EFFECTIVE = 'November 2, 2026';

export const metadata: Metadata = {
  title: 'Privacy · Bounty Index',
  description:
    'What bounty.index collects, why, and your choices. Plain language, grounded in exactly what the code does. No ad trackers, no data selling.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <div className="border-b border-neutral-900 pb-6 reveal">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Privacy · effective {EFFECTIVE}</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Privacy</h1>
        <p className="text-neutral-400 mt-3 max-w-2xl leading-relaxed">
          I&rsquo;m Varun, and I run bounty.index on my own. This page is the honest version of what the site collects and
          why. No ad trackers, nothing sold, nothing shared beyond the handful of services it takes to keep the lights on.
        </p>
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">The short version</h2>
        <ul className="text-sm text-neutral-400 leading-relaxed space-y-2 list-disc pl-5">
          <li>Browse without signing in and I collect no personal data about you, just anonymous, aggregated traffic counts.</li>
          <li>Sign in with GitHub and I store your GitHub name, email, and avatar so your account works across devices.</li>
          <li>Everything you save (watchlist, notes, filters, alerts) is yours. Delete your account and it all goes with it.</li>
          <li>No cookie banner, because the only cookie is the one that keeps you signed in, and the analytics are cookieless.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-6">
        <h2 className="text-xl font-semibold text-neutral-100">What I collect, and when</h2>

        <div className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40">
          <h3 className="text-neutral-100 font-medium mb-2">When you just browse</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Nothing that identifies you. The site uses Vercel Web Analytics, which is cookieless and counts page views in
            aggregate without building a profile of you. My host (Vercel) also keeps short-lived server logs that include
            IP addresses, the normal plumbing every website has, used to serve pages and stop abuse.
          </p>
        </div>

        <div className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40">
          <h3 className="text-neutral-100 font-medium mb-2">When you sign in with GitHub</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Signing in is optional and only unlocks the saved features below. When you do, GitHub shares your profile and I
            store your <span className="text-neutral-200">name, email, and avatar image</span>, plus the OAuth tokens that
            link your account to GitHub. If the database is briefly down during sign-in, that same GitHub profile is held in
            a short queue so your account still gets created once service returns. I never see or store your GitHub password.
          </p>
        </div>

        <div className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40">
          <h3 className="text-neutral-100 font-medium mb-2">The things you save</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Tied to your account: your watchlist, your compare list, saved filters, private notes on programs, and any
            response-time reports you submit (with the optional short comment). Private notes stay private to you. Reports
            are pooled into anonymous aggregates (like a median first-response time); your individual rows are not shown to
            other users.
          </p>
        </div>

        <div className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40">
          <h3 className="text-neutral-100 font-medium mb-2">Discord alerts</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            If you set up alerts, I store the Discord webhook URL you give me and what you want it to watch, so the cron job
            can post to your channel. You can delete a subscription any time and the row is gone. Delivering an alert means
            sending that message to Discord, which is governed by Discord&rsquo;s own privacy policy.
          </p>
        </div>

        <div className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40">
          <h3 className="text-neutral-100 font-medium mb-2">The MCP endpoint</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            The public MCP endpoint is open and needs no account. For each request I log the IP address and user-agent, with
            no name attached, purely to count how many tools connect and to catch abuse. It is not linked to any signed-in
            account.
          </p>
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Why I hold it, and the legal basis</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Account data exists to run the features you asked for: that is performance of the service you signed up for. Server
          logs and the MCP request log exist to keep the site up and stop abuse: that is my legitimate interest in a working,
          un-abused site. I do not use any of it for advertising, and I do not sell or rent it to anyone.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Who else touches it</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Only the services it takes to run the site, each acting as a processor on my behalf:
        </p>
        <ul className="text-sm text-neutral-400 leading-relaxed space-y-2 list-disc pl-5">
          <li><span className="text-neutral-200">GitHub</span> handles sign-in (OAuth).</li>
          <li><span className="text-neutral-200">Neon</span> hosts the Postgres database where your account data lives.</li>
          <li><span className="text-neutral-200">Vercel</span> hosts the site, the cookieless analytics, and the brief sign-in queue.</li>
          <li><span className="text-neutral-200">Discord</span> receives alert messages, but only for subscriptions you create.</li>
        </ul>
        <p className="text-sm text-neutral-400 leading-relaxed">
          These providers may process data in the US or the EU. That is the only sharing that happens.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Cookies</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          One cookie, and it is the session cookie that keeps you signed in after you log in with GitHub. It is strictly
          necessary for the account to work, so there is no consent banner to click through. The analytics are cookieless
          and store nothing on your device. If I ever add a tracker that is not strictly necessary, this section and the
          banner situation change, and I will say so here first.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">How long I keep it</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Account data stays until you delete your account, at which point every row tied to you (watchlist, notes, filters,
          reports, alert subscriptions) is removed with it. Server logs and the MCP request log are short-lived and kept only
          as long as they are useful for running and protecting the site. Public program data in the index is not personal
          data about you and is kept as part of the catalog.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Your choices and rights</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Depending on where you live (the EU, UK, and California give explicit versions of these), you can ask to access a
          copy of your data, correct it, delete it, export it, or object to a particular use. The fastest route for most of
          it is in the app: delete a note, clear a watchlist item, remove an alert, or delete your account to wipe
          everything. For anything the app does not cover, email me and I will sort it out. I will never charge you for a
          request or make you jump through hoops to leave.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Children</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          This is a tool for security researchers and is not aimed at children. I don&rsquo;t knowingly collect data from
          anyone under 16. If you believe a child has signed in, email me and I&rsquo;ll remove the account.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Changes</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          If the site starts collecting something new, I&rsquo;ll update this page and move the effective date at the top. No
          quiet changes to how your data is used.
        </p>
      </section>

      <section className="mt-12 border-t border-neutral-900 pt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-neutral-400 leading-relaxed">
          Questions, or want to exercise any of the above? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:underline">{CONTACT_EMAIL}</a>.
        </p>
        <Link href="/terms" className="mono text-xs text-neutral-400 hover:text-emerald-400 transition">terms →</Link>
      </section>
    </div>
  );
}
