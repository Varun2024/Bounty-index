'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addWebhook } from '@/app/actions/discord';

interface PrefillProgram {
  id: number;
  name: string;
  platform: string;
  slug: string;
}

interface Props {
  prefillProgram: PrefillProgram | null;
}

export function AddWebhookForm({ prefillProgram }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [programId, setProgramId] = useState<number | null>(prefillProgram?.id ?? null);
  const [programQuery, setProgramQuery] = useState(prefillProgram?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
