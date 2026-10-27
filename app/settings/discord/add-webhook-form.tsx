'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addWebhook, addWebhooksBatch, testWebhookUrl, type BatchSource } from '@/app/actions/discord';

interface PrefillProgram {
  id: number;
  name: string;
  platform: string;
  slug: string;
}

interface Props {
  prefillProgram: PrefillProgram | null;
  watchlistCount: number;
}

export function AddWebhookForm({ prefillProgram, watchlistCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [programId, setProgramId] = useState<number | null>(prefillProgram?.id ?? null);
  const [programQuery, setProgramQuery] = useState(prefillProgram?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [bulkPending, startBulk] = useTransition();
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onBulk(source: BatchSource) {
    setBulkMsg(null);
    if (!url.trim()) {
      setBulkMsg({ ok: false, text: 'paste a webhook URL first' });
      return;
    }
    startBulk(async () => {
      const res = await addWebhooksBatch({ webhookUrl: url, source, label: label || null });
      if (res.ok) {
        const over = res.skipped ? ` (${res.skipped} over the cap, skipped)` : '';
        setBulkMsg({ ok: true, text: `subscribed ${res.added} program${res.added === 1 ? '' : 's'}${over}` });
        setUrl('');
        setLabel('');
        router.refresh();
      } else {
        setBulkMsg({ ok: false, text: res.error });
      }
    });
  }

  function onTest() {
    setTestMsg(null);
    if (!url.trim()) {
      setTestMsg({ ok: false, text: 'paste a webhook URL first' });
      return;
    }
    startTest(async () => {
      const res = await testWebhookUrl(url);
      if (res.ok) setTestMsg({ ok: true, text: 'sent — check your Discord channel' });
      else setTestMsg({ ok: false, text: res.error });
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!programId) {
      setError('pick a program first');
      return;
    }
    startTransition(async () => {
      const res = await addWebhook({ programId, webhookUrl: url, label: label || null });
      if (res.ok) {
        setSuccess(`subscribed · ${prefillProgram?.name ?? programQuery}`);
        setUrl('');
        setLabel('');
        if (!prefillProgram) {
          setProgramQuery('');
          setProgramId(null);
        }
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="border border-neutral-900 rounded-lg p-5 bg-neutral-950/40 space-y-4">
      {prefillProgram ? (
        <div>
          <label className="mono text-[10px] uppercase tracking-widest text-neutral-500">Program</label>
          <p className="mt-1 text-sm text-neutral-100">
            {prefillProgram.name} <span className="mono text-xs text-neutral-500">· {prefillProgram.platform}</span>
          </p>
          <input type="hidden" value={prefillProgram.id} />
        </div>
      ) : (
        <ProgramPicker
          value={programQuery}
          onSelect={(id, name) => {
            setProgramId(id);
            setProgramQuery(name);
          }}
        />
      )}

      <div>
        <label htmlFor="webhook-url" className="mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-1">Discord webhook URL</label>
        <input
          id="webhook-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          className="w-full mono text-xs px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 focus:border-emerald-400/60 focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onTest}
            disabled={testing || !url}
            className="mono text-[11px] px-2.5 py-1 border border-neutral-800 rounded text-neutral-400 hover:text-emerald-300 hover:border-emerald-400/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? 'sending…' : 'send test →'}
          </button>
          {testMsg && (
            <span className={`mono text-[11px] ${testMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {testMsg.ok ? '✓' : '✗'} {testMsg.text}
            </span>
          )}
          {!testMsg && <span className="mono text-[11px] text-neutral-600">{'// '}fire a sample embed now, before you save</span>}
        </div>
      </div>

      <div>
        <label htmlFor="webhook-label" className="mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-1">Label <span className="text-neutral-700">(optional)</span></label>
        <input
          id="webhook-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="#security-alerts"
          maxLength={60}
          className="w-full text-sm px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 focus:border-emerald-400/60 focus:outline-none"
        />
      </div>

      {error && <p className="mono text-xs text-red-400">✗ {error}</p>}
      {success && <p className="mono text-xs text-emerald-400">✓ {success}</p>}

      <button
        type="submit"
        disabled={pending || !url || !programId}
        className="mono text-xs px-4 py-2 border border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300 rounded hover:bg-emerald-400/[0.12] transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? 'saving…' : 'subscribe →'}
      </button>

      <div className="pt-4 border-t border-neutral-900">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">or subscribe in bulk</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onBulk('watchlist')}
            disabled={bulkPending || !url || watchlistCount === 0}
            title={watchlistCount === 0 ? 'add programs to your watchlist first' : undefined}
            className="mono text-[11px] px-2.5 py-1 border border-neutral-800 rounded text-neutral-300 hover:text-emerald-300 hover:border-emerald-400/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            my watchlist ({watchlistCount})
          </button>
          <button
            type="button"
            onClick={() => onBulk('top-paying')}
            disabled={bulkPending || !url}
            className="mono text-[11px] px-2.5 py-1 border border-neutral-800 rounded text-neutral-300 hover:text-emerald-300 hover:border-emerald-400/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            top 10 paying
          </button>
          {bulkPending && <span className="mono text-[11px] text-neutral-500">adding…</span>}
          {bulkMsg && (
            <span className={`mono text-[11px] ${bulkMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {bulkMsg.ok ? '✓' : '✗'} {bulkMsg.text}
            </span>
          )}
        </div>
        <p className="mono text-[10px] text-neutral-600 mt-2">{'// '}points the URL above at every matching program at once</p>
      </div>
    </form>
  );
}

interface ProgramPickerProps {
  value: string;
  onSelect: (id: number, name: string) => void;
}

// Minimal search-by-name picker. Hits /api/search-programs (which already exists for
// the header search). Debounced to 200ms, top 8 results.
function ProgramPicker({ value, onSelect }: ProgramPickerProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Array<{ id: number; name: string; platform: string }>>([]);
  const [open, setOpen] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    if (!q.trim() || q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/search-programs?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = (await res.json()) as { rows: Array<{ id: number; name: string; platform: string }> };
        setResults(data.rows ?? []);
      }
    } catch {
      setResults([]);
    }
  }

  return (
    <div className="relative">
      <label htmlFor="program-search" className="mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-1">Program</label>
      <input
        id="program-search"
        type="text"
        required
        value={query}
        onChange={onChange}
        onFocus={() => setOpen(true)}
        placeholder="search by name…"
        className="w-full text-sm px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 focus:border-emerald-400/60 focus:outline-none"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto border border-neutral-800 bg-neutral-950 rounded shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(r.id, r.name);
                  setQuery(r.name);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
              >
                {r.name} <span className="mono text-xs text-neutral-500">· {r.platform}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
