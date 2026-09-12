import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { programs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { listMyWebhooks } from '@/app/actions/discord';
import { AddWebhookForm } from './add-webhook-form';
import { WebhookRow } from './webhook-row';
import { UnavailablePanel } from '@/app/_ui/unavailable-panel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discord alerts · Bounty Index',
  description: 'Pipe scope + reward changes into your Discord server via a webhook. Zero email, one HTTPS POST.',
  alternates: { canonical: '/settings/discord' },
};

interface PageProps {
  searchParams: Promise<{ program?: string }>;
}

export default async function DiscordSettingsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) return <SignInPrompt />;

  const { program: programParam } = await searchParams;
  const prefillProgramId = programParam ? Number(programParam) : null;
  const prefillProgram =
    prefillProgramId && Number.isFinite(prefillProgramId) && prefillProgramId > 0
      ? (
          await db
            .select({ id: programs.id, name: programs.name, platform: programs.platform, slug: programs.slug })
            .from(programs)
            .where(eq(programs.id, prefillProgramId))
            .limit(1)
            .catch(() => [])
        )[0] ?? null
      : null;

  // ponytail: null means the DB read failed (Neon quota etc). Distinguish from empty [].
  const rows = await listMyWebhooks().catch(() => null);

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <header className="border-b border-neutral-900 pb-6 mb-8">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Settings · Discord alerts</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Discord alerts</h1>
        <p className="mt-3 text-sm text-neutral-400 max-w-2xl leading-relaxed">
          Pipe scope, reward, and safe-harbor changes into a channel in your own Discord server. One HTTPS POST per event.
          No email, no bot to invite, no OAuth.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">1 · Get a webhook URL from Discord</h2>
        <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
          Discord tucks webhooks in two places. Both work. Use whichever is closer to where you are in Discord.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-neutral-900 rounded-lg p-4 bg-neutral-950/40">
            <p className="mono text-[10px] uppercase tracking-widest text-emerald-400 mb-2">Fastest · channel-level</p>
            <ol className="text-sm text-neutral-400 space-y-1.5 list-decimal pl-5 leading-relaxed">
              <li>In Discord, hover the channel you want alerts in and click the <span className="text-neutral-200">⚙︎</span> icon (or right-click &rarr; <span className="text-neutral-200">Edit Channel</span>).</li>
              <li>Left sidebar &rarr; <span className="text-neutral-200">Integrations</span>.</li>
              <li>Click <span className="text-neutral-200">Webhooks</span> &rarr; <span className="text-neutral-200">New Webhook</span>.</li>
              <li>Rename it if you want, then click <span className="text-neutral-200">Copy Webhook URL</span>.</li>
            </ol>
          </div>

          <div className="border border-neutral-900 rounded-lg p-4 bg-neutral-950/40">
            <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Alternate · server-level</p>
            <ol className="text-sm text-neutral-400 space-y-1.5 list-decimal pl-5 leading-relaxed">
              <li>Click your server name at the top-left &rarr; <span className="text-neutral-200">Server Settings</span>.</li>
              <li>Left sidebar &rarr; scroll to <span className="text-neutral-500 mono text-[10px] uppercase tracking-widest">Apps</span> &rarr; <span className="text-neutral-200">Integrations</span>.</li>
              <li>Click the <span className="text-neutral-200">Webhooks</span> card &rarr; <span className="text-neutral-200">New Webhook</span>.</li>
              <li>Pick a channel &rarr; <span className="text-neutral-200">Copy Webhook URL</span>.</li>
            </ol>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p className="text-neutral-500">
            <span className="mono text-[10px] uppercase tracking-widest text-amber-400 mr-2">can&rsquo;t find it?</span>
            You need the <span className="text-neutral-300">Manage Webhooks</span> permission on that server.
            If it&rsquo;s someone else&rsquo;s server, ask an admin — or make your own test server
            (Discord left rail &rarr; <span className="text-neutral-300">+</span> &rarr; <span className="text-neutral-300">Create My Own</span> &rarr; <span className="text-neutral-300">For me and my friends</span>) where you&rsquo;re automatically admin.
          </p>
          <p className="text-neutral-500">
            <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 mr-2">on mobile?</span>
            Long-press the channel &rarr; <span className="text-neutral-300">Edit Channel</span> &rarr; <span className="text-neutral-300">Webhooks</span>. Same flow, one extra tap.
          </p>
          <p className="text-neutral-500">
            <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 mr-2">the URL</span>
            looks like <code className="mono text-[10px] text-neutral-400 break-all">https://discord.com/api/webhooks/1234567890/AbCd-xyz…</code> —
            treat it like a password. Anyone with it can post to that channel.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">2 · Paste the URL &amp; pick a program</h2>
        <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
          Paste the URL you copied above. Pick which program should fire it — you can add more later. Optional label helps you tell subscriptions apart when you have several (e.g. <span className="mono text-neutral-400">#alerts</span>).
        </p>
        <AddWebhookForm prefillProgram={prefillProgram} />
        <p className="mt-3 mono text-[11px] text-neutral-600">
          {'// '}after saving, hit <span className="text-emerald-400">test</span> on the row to fire a sample embed right now — no need to wait for the daily cron.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">
          Your subscriptions <span className="mono text-xs text-neutral-500">· {rows?.length ?? '—'}</span>
        </h2>
        {rows === null ? (
          <UnavailablePanel what="Subscription list" />
        ) : rows.length === 0 ? (
          <div className="border border-neutral-900 rounded-lg p-8 bg-neutral-950/40 text-center">
            <p className="mono text-xs uppercase tracking-widest text-neutral-500">— nothing subscribed yet —</p>
            <p className="mt-3 text-sm text-neutral-500">
              Open a program and hit the <span className="mono text-emerald-400">Discord alerts</span> button, or paste a URL above.
            </p>
          </div>
        ) : (
          <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 divide-y divide-neutral-900">
            {rows.map((r) => (
              <WebhookRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="max-w-[600px] mx-auto px-6 py-20 text-center">
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Settings · Discord alerts</p>
      <h1 className="text-2xl font-semibold text-neutral-100">Sign in first</h1>
      <p className="mt-3 text-sm text-neutral-400">
        Webhook subscriptions live on your account so they follow you between machines.
      </p>
      <Link
        href="/api/auth/signin?callbackUrl=%2Fsettings%2Fdiscord"
        className="mt-6 inline-flex items-center gap-2 mono text-sm px-4 py-2 border border-neutral-800 rounded-md text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900 transition"
      >
        sign in with GitHub →
      </Link>
    </div>
  );
}
