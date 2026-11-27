'use client';

import { useState, useTransition } from 'react';
import { createTokenAction, revokeTokenAction, getMyTokens, type SerializedToken } from '@/app/actions/mcp-tokens';

interface TokenManagerProps {
  initialTokens: SerializedToken[];
}

export function TokenManager({ initialTokens }: TokenManagerProps) {
  const [tokens, setTokens] = useState<SerializedToken[]>(initialTokens);
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<string | null>(null); // plaintext token, shown once
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    getMyTokens().then(setTokens).catch(() => {});
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await createTokenAction(label.trim() || undefined);
      if (res.ok && res.token) {
        setCreated(res.token);
        setLabel('');
        refresh();
      } else {
        setError(res.error ?? 'Could not create token.');
      }
    });
  }

  function onRevoke(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await revokeTokenAction(id);
      if (res.ok) {
        setTokens((ts) => ts.filter((t) => t.id !== id));
      } else {
        setError(res.error ?? 'Could not revoke token.');
      }
    });
  }

  async function copyToken() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      setError('Copy failed, select the token and copy it manually.');
    }
  }

  return (
    <div>
      {/* One-time reveal of a freshly created token. */}
      {created && (
        <div className="mb-6 rounded-lg border border-emerald-400/40 bg-emerald-400/[0.05] p-4">
          <p className="mono text-[11px] uppercase tracking-widest text-emerald-400 mb-2">new token · shown once</p>
          <p className="text-sm text-neutral-300 mb-3 leading-relaxed">
            Copy it now and store it somewhere safe. It is not stored in plaintext, so you cannot see it again.
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 mono text-[12px] text-neutral-100 bg-neutral-950/70 border border-neutral-800 rounded-md px-3 py-2 break-all select-all">
              {created}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className="mono text-sm px-4 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition focus-ring shrink-0"
            >
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="mt-3 mono text-[11px] text-neutral-400 hover:text-neutral-200 transition focus-ring rounded"
          >
            done, hide it
          </button>
        </div>
      )}

      {/* Create form. */}
      <form onSubmit={onCreate} className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label htmlFor="token-label" className="block mono text-[11px] uppercase tracking-widest text-neutral-400 mb-1.5">
            label (optional)
          </label>
          <input
            id="token-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="e.g. claude-desktop"
            className="w-full bg-neutral-950/60 border border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus-ring"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition focus-ring disabled:opacity-50 shrink-0"
        >
          {pending ? 'working…' : 'create token'}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-amber-400">{error}</p>}

      {/* Existing tokens. */}
      {tokens.length === 0 ? (
        <div className="border border-neutral-900 rounded-lg p-8 bg-neutral-950/40 text-center">
          <p className="mono text-xs uppercase tracking-widest text-neutral-400">no tokens yet</p>
          <p className="mt-3 text-sm text-neutral-400">Create one above to let your agent subscribe programs to Discord alerts.</p>
        </div>
      ) : (
        <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 divide-y divide-neutral-900">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-neutral-100 truncate">{t.label || <span className="text-neutral-500">unlabeled</span>}</p>
                <p className="mono text-[11px] text-neutral-500 mt-0.5">
                  created {t.createdAt.slice(0, 10)} · {t.lastUsedAt ? `last used ${t.lastUsedAt.slice(0, 10)}` : 'never used'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRevoke(t.id)}
                disabled={pending}
                className="mono text-[11px] uppercase tracking-widest text-neutral-400 border border-neutral-800 rounded-md px-3 py-1.5 hover:border-amber-400/50 hover:text-amber-400 transition focus-ring disabled:opacity-50 shrink-0"
              >
                revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
