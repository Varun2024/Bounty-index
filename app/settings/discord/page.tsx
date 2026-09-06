import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { programs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { listMyWebhooks } from '@/app/actions/discord';
import { AddWebhookForm } from './add-webhook-form';
import { WebhookRow } from './webhook-row';

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
        )[0] ?? null
      : null;

  const rows = await listMyWebhooks();

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
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">1 · Get a webhook URL from Discord</h2>
        <ol className="text-sm text-neutral-400 space-y-2 list-decimal pl-5 leading-relaxed">
          <li>Open your Discord server &rarr; <span className="text-neutral-200">Server Settings</span> &rarr; <span className="text-neutral-200">Integrations</span> &rarr; <span className="text-neutral-200">Webhooks</span>.</li>
          <li>Click <span className="text-neutral-200">New Webhook</span>, pick a channel, give it a name, click <span className="text-neutral-200">Copy Webhook URL</span>.</li>
          <li>Paste the URL below and pick which program should ping it.</li>
        </ol>
        <p className="mt-3 mono text-[11px] text-neutral-600">
          {'// '}the URL is treated as a secret — anyone with it can post to your channel. We only accept
          <code className="mono text-neutral-400"> discord.com/api/webhooks/…</code> URLs.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">2 · Add a subscription</h2>
        <AddWebhookForm prefillProgram={prefillProgram} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">Your subscriptions <span className="mono text-xs text-neutral-500">· {rows.length}</span></h2>
        {rows.length === 0 ? (
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
