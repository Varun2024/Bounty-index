import Link from 'next/link';
import type { Metadata } from 'next';
import { getProgramsByIds } from '@/lib/db/queries';
import { formatBounty, platformLabel, relativeTime } from '@/lib/format';
import { RemoveColumnButton } from './remove-column-button';
import { PlatformLogo } from '@/app/_ui/platform-logo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compare programs · Bounty Index',
  description: 'Side-by-side comparison of bug bounty programs.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseIds(v: string | string[] | undefined): number[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v.join(',') : v;
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 4);
}

export default async function ComparePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const ids = parseIds(sp.ids);

  const programs = ids.length ? await getProgramsByIds(ids).catch(() => []) : [];

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-10">
      <header className="mb-8">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Side by side</p>
        <h1 className="text-3xl font-semibold text-neutral-100 tracking-tight">Compare programs</h1>
        <p className="mt-3 text-sm text-neutral-400 max-w-2xl">
          Pick up to 4 programs to compare rewards, scope, safe harbor, and platform side by side.
          Selections persist in your browser — no account needed.
        </p>
      </header>

      {programs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-neutral-900 bg-neutral-950/60">
                <th className="text-left px-5 py-4 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-40 align-top">
                  Field
                </th>
                {programs.map((p) => (
                  <th key={p.id} className="text-left px-5 py-4 align-top">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <PlatformLogo platform={p.platform} size="md" className="mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <Link
                            href={`/programs/${p.platform}/${p.slug}`}
                            className="text-neutral-100 hover:text-emerald-400 transition font-medium block truncate"
                          >
                            {p.name}
                          </Link>
                          <div className="mono text-[11px] text-neutral-500 mt-1">
                            {platformLabel(p.platform)}
                          </div>
                        </div>
                      </div>
                      <RemoveColumnButton programId={p.id} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Program type" values={programs.map((p) => (
                <TypeBadge key={p.id} type={p.programType} offersBounty={p.offersBounty} />
              ))} />
              <Row label="Max payout" values={programs.map((p) => (
                <span key={p.id} className={p.maxBounty ? 'mono text-emerald-300 tabular-nums' : 'text-neutral-600'}>
                  {p.maxBounty ? formatBounty(p.maxBounty, p.currency ?? 'USD') : '—'}
                </span>
              ))} />
              <Row label="Min payout" values={programs.map((p) => (
                <span key={p.id} className={p.minBounty ? 'mono text-neutral-200 tabular-nums' : 'text-neutral-600'}>
                  {p.minBounty ? formatBounty(p.minBounty, p.currency ?? 'USD') : '—'}
                </span>
              ))} />
              <Row label="Safe harbor" values={programs.map((p) => <SafeHarborCell key={p.id} value={p.safeHarbor} />)} />
              <Row label="In-scope assets" values={programs.map((p) => (
                <span key={p.id} className="mono tabular-nums text-neutral-200">{p.scopeInScope}</span>
              ))} />
              <Row label="Total scopes" values={programs.map((p) => (
                <span key={p.id} className="mono tabular-nums text-neutral-400">{p.scopeTotal}</span>
              ))} />
              <Row label="Managed" values={programs.map((p) => (
                <YesNo key={p.id} v={p.managed} />
              ))} />
              <Row label="Swag" values={programs.map((p) => (
                <YesNo key={p.id} v={p.offersSwag} />
              ))} />
              <Row label="Status" values={programs.map((p) => (
                <span key={p.id} className="mono text-xs text-neutral-400">{p.submissionState ?? '—'}</span>
              ))} />
              <Row label="Last updated" values={programs.map((p) => (
                <span key={p.id} className="mono text-xs text-neutral-500">
                  {p.lastUpdatedAt ? relativeTime(p.lastUpdatedAt) : '—'}
                </span>
              ))} />
              <Row label="Program page" values={programs.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mono text-xs text-emerald-400 hover:text-emerald-300 transition break-all"
                >
                  open ↗
                </a>
              ))} />
            </tbody>
          </table>
        </div>
      )}

      {programs.length > 0 && programs.length < 4 && (
        <p className="mt-6 mono text-[11px] text-neutral-500">
          Add more from any <Link href="/programs" className="text-emerald-400 hover:text-emerald-300 transition">program page</Link>. Max 4.
        </p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-neutral-900 rounded-lg p-12 bg-neutral-950/40 text-center">
      <p className="mono text-xs uppercase tracking-widest text-neutral-500">— no programs picked yet —</p>
      <p className="mt-3 text-neutral-400 text-sm">
        Open any program and hit <span className="mono text-emerald-300">+ compare</span> to add it here.
      </p>
      <Link
        href="/programs"
        className="mt-6 inline-flex items-center gap-2 mono text-sm px-4 py-2 border border-neutral-800 rounded-md text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900 transition"
      >
        browse programs →
      </Link>
    </div>
  );
}

interface RowProps {
  label: string;
  values: React.ReactNode[];
}

function Row({ label, values }: RowProps) {
  return (
    <tr className="border-b border-neutral-900 last:border-b-0">
      <td className="px-5 py-3.5 mono text-[11px] uppercase tracking-widest text-neutral-500 align-top">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-5 py-3.5 align-top">{v}</td>
      ))}
    </tr>
  );
}

function TypeBadge({ type, offersBounty }: { type: string; offersBounty: boolean }) {
  return (
    <span
      className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${
        offersBounty
          ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.06]'
          : 'text-neutral-500 border-neutral-800 bg-neutral-900/50'
      }`}
    >
      {type}
    </span>
  );
}

function SafeHarborCell({ value }: { value: string | null }) {
  if (!value) return <span className="mono text-xs text-neutral-600">unknown</span>;
  const color =
    value === 'full'
      ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.06]'
      : value === 'partial'
        ? 'text-amber-300 border-amber-400/30 bg-amber-400/[0.06]'
        : 'text-red-400 border-red-500/30 bg-red-500/[0.06]';
  return (
    <span className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${color}`}>
      {value}
    </span>
  );
}

function YesNo({ v }: { v: boolean }) {
  return v ? (
    <span className="mono text-xs text-emerald-300">yes</span>
  ) : (
    <span className="mono text-xs text-neutral-600">no</span>
  );
}
