'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeWebhook, testWebhook } from '@/app/actions/discord';
import type { UserWebhookRow } from '@/app/actions/discord';

interface Props {
  row: UserWebhookRow;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function WebhookRow({ row }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onDelete() {
    if (!confirm(`Remove Discord alert for ${row.programName}?`)) return;
    startTransition(async () => {
      await removeWebhook(row.id);
      router.refresh();
    });
  }

  function onTest() {
    setTestMsg(null);
    startTransition(async () => {
      const res = await testWebhook(row.id);
      if (res.ok) setTestMsg({ ok: true, text: 'sent — check Discord' });
      else setTestMsg({ ok: false, text: res.error });
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-3 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/programs/${row.programPlatform}/${row.programSlug}`}
            className="text-sm text-neutral-100 hover:text-emerald-400 transition font-medium truncate"
          >
            {row.programName}
          </Link>
          <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">{row.programPlatform}</span>
          {row.brokenAt && (
            <span className="mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-red-400/40 text-red-300 bg-red-400/[0.06]">
              broken — resave URL
            </span>
          )}
        </div>
        <p className="mono text-[11px] text-neutral-500 mt-1 truncate">
          {row.label ? <span className="text-neutral-300">{row.label} · </span> : null}
          {row.webhookUrlHint}
          <span className="text-neutral-700"> · </span>
          last delivered {relativeTime(row.lastDeliveredAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {testMsg && (
          <span className={`mono text-[11px] ${testMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {testMsg.ok ? '✓' : '✗'} {testMsg.text}
          </span>
        )}
        <button
          onClick={onTest}
          disabled={pending}
          className="mono text-[11px] px-2.5 py-1 border border-neutral-800 rounded text-neutral-400 hover:text-emerald-300 hover:border-emerald-400/40 transition disabled:opacity-40"
        >
          {pending ? '…' : 'test'}
        </button>
        <button
          onClick={onDelete}
          disabled={pending}
          className="mono text-[11px] px-2.5 py-1 border border-neutral-800 rounded text-neutral-500 hover:text-red-300 hover:border-red-400/40 transition disabled:opacity-40"
        >
          remove
        </button>
      </div>
    </li>
  );
}
