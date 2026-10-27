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

const SIGNIN_HREF = '/api/auth/signin?callbackUrl=%2Fsettings%2Fdiscord';

interface PageProps {
  searchParams: Promise<{ program?: string }>;
}

export default async function DiscordSettingsPage({ searchParams }: PageProps) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  const { program: programParam } = await searchParams;
  const prefillProgramId = programParam ? Number(programParam) : null;

  // Only touch the DB when signed in — the whole page renders for signed-out
  // visitors so they can see the value and do the Discord-side work first.
  const prefillProgram =
    signedIn && prefillProgramId && Number.isFinite(prefillProgramId) && prefillProgramId > 0
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
  const rows = signedIn ? await listMyWebhooks().catch(() => null) : null;

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
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">What lands in your channel</h2>
        <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
          Every time a program you follow changes scope, reward, or safe-harbor status, an embed like this shows up in the
          channel you pick. Color coded: green for pure additions, amber when anything is removed, sky for reward-only moves.
        </p>
        <DiscordEmbedPreview />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">1 · Get a webhook URL from Discord</h2>

        <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.05] p-4">
          <p className="text-sm text-neutral-200 leading-relaxed">
            <span className="mono text-[10px] uppercase tracking-widest text-emerald-400 mr-2">no server you admin?</span>
            Make your own in about 20 seconds and you&rsquo;re automatically admin:
            Discord left rail <span className="text-neutral-100">+</span> &rarr;
            <span className="text-neutral-100"> Create My Own</span> &rarr;
            <span className="text-neutral-100"> For me and my friends</span>. Then follow either path below in that server.
            This is the usual unblock — webhook creation needs the <span className="text-neutral-100">Manage Webhooks</span>{' '}
            permission, which you won&rsquo;t have on servers you don&rsquo;t run.
          </p>
        </div>

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
            <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 mr-2">on mobile?</span>
            Long-press the channel &rarr; <span className="text-neutral-300">Edit Channel</span> &rarr; <span className="text-neutral-300">Webhooks</span>. Same flow, one extra tap.
          </p>
          <p className="text-neutral-500">
            <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 mr-2">the URL</span>
            looks like <code className="mono text-[10px] text-neutral-400 break-all">https://discord.com/api/webhooks/1234567890/AbCd-xyz…</code>,
            treat it like a password. Anyone with it can post to that channel.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">2 · Paste the URL &amp; pick a program</h2>
        {signedIn ? (
          <>
            <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
              Paste the URL you copied above. Pick which program should fire it — you can add more later. Optional label helps you tell subscriptions apart when you have several (e.g. <span className="mono text-neutral-400">#alerts</span>).
            </p>
            <AddWebhookForm prefillProgram={prefillProgram} />
            <p className="mt-3 mono text-[11px] text-neutral-600">
              {'// '}after saving, hit <span className="text-emerald-400">test</span> on the row to fire a sample embed right now — no need to wait for the daily cron.
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-neutral-900 bg-neutral-950/40 p-6">
            <p className="text-sm text-neutral-300 leading-relaxed">
              Already copied your webhook URL? Sign in to connect it. GitHub OAuth, no email — your subscriptions follow you
              between machines, not into your inbox. (Sign-in is only needed to save a subscription, so bounty.index can&rsquo;t
              be used to spam a channel anonymously.)
            </p>
            <Link
              href={SIGNIN_HREF}
              className="mt-5 inline-flex items-center gap-2 mono text-sm px-4 py-2 border border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300 rounded-md hover:bg-emerald-400/[0.12] transition"
            >
              sign in with GitHub →
            </Link>
          </div>
        )}
      </section>

      {signedIn && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-100 mb-3">
            Your subscriptions <span className="mono text-xs text-neutral-500">· {rows?.length ?? '—'}</span>
          </h2>
          {rows === null ? (
            <UnavailablePanel what="Subscription list" />
          ) : rows.length === 0 ? (
            <div className="border border-neutral-900 rounded-lg p-8 bg-neutral-950/40 text-center">
              <p className="mono text-xs uppercase tracking-widest text-neutral-500">— zero webhooks —</p>
              <p className="mt-3 text-sm text-neutral-500">
                The cron still runs. It&rsquo;s just talking to itself. Open a program and hit
                <span className="mono text-emerald-400"> Discord alerts</span>, or paste a URL above.
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
      )}
    </div>
  );
}

// Static, non-interactive mock of the Discord embed users receive. No live fire
// (that needs auth to avoid being an open relay) — this just shows the shape.
function DiscordEmbedPreview() {
  return (
    <div className="rounded-lg border border-neutral-900 bg-[#313338] p-4 max-w-xl">
      <div className="flex gap-3">
        <div className="w-1 rounded-full bg-emerald-400 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="mono text-[11px] text-neutral-400 mb-1">HackerOne</p>
          <p className="text-sm font-semibold text-sky-300">Shopify</p>
          <p className="text-xs text-neutral-300 mt-0.5">+3 added · reward $50k → $75k</p>
          <div className="mt-2 rounded bg-[#1e1f22] p-2 mono text-[11px] leading-relaxed text-neutral-300">
            <p className="text-emerald-400">+ api.new-service.shopify.com</p>
            <p className="text-emerald-400">+ *.checkout-v2.shopify.com</p>
            <p className="text-emerald-400">+ mobile.shopify.com</p>
          </div>
          <p className="mono text-[10px] text-neutral-500 mt-2">bountyindex.in · just now</p>
        </div>
      </div>
    </div>
  );
}
