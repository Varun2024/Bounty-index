import { scopeHref, shortenIdentifier } from '@/lib/format';
import { ExternalIcon } from '@/app/_ui/icons';
import { SectionHeading } from '@/app/_ui/section-heading';

export interface TagProps {
  active?: boolean;
  children: React.ReactNode;
}

export function Tag({ active, children }: TagProps) {
  return (
    <span
      className={`px-2 py-1 rounded border uppercase tracking-widest ${
        active
          ? 'border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300'
          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400'
      }`}
    >
      {children}
    </span>
  );
}

export interface ScopeItem {
  id: number;
  identifier: string;
  assetType: string;
  severity: string | null;
}

interface ScopeColumnProps {
  kind: 'in' | 'out';
  items: ScopeItem[];
}

// Hunter-order: what they scan first, then edge cases. Anything unknown falls at the end.
const ASSET_TYPE_ORDER = ['wildcard', 'url', 'api', 'android', 'ios', 'source_code', 'hardware', 'smart_contract', 'other'];

const ASSET_TYPE_LABEL: Record<string, string> = {
  wildcard: 'wildcards',
  url: 'urls',
  api: 'apis',
  android: 'android',
  ios: 'ios',
  source_code: 'source code',
  hardware: 'hardware',
  smart_contract: 'smart contracts',
  other: 'other',
};

function groupByAssetType(items: ScopeItem[]): { type: string; items: ScopeItem[] }[] {
  const buckets = new Map<string, ScopeItem[]>();
  for (const item of items) {
    const t = item.assetType || 'other';
    const existing = buckets.get(t);
    if (existing) existing.push(item);
    else buckets.set(t, [item]);
  }
  const knownOrdered = ASSET_TYPE_ORDER.filter((t) => buckets.has(t)).map((t) => ({ type: t, items: buckets.get(t)! }));
  const unknown = [...buckets.keys()].filter((t) => !ASSET_TYPE_ORDER.includes(t)).map((t) => ({ type: t, items: buckets.get(t)! }));
  return [...knownOrdered, ...unknown];
}

export function ScopeColumn({ kind, items }: ScopeColumnProps) {
  const isIn = kind === 'in';
  const title = isIn ? 'In scope' : 'Out of scope';
  const buckets = groupByAssetType(items);
  const shouldGroup = buckets.length > 1;

  return (
    <section>
      <SectionHeading title={title}>
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {items.length.toString().padStart(3, '0')}
        </span>
      </SectionHeading>
      {items.length === 0 ? (
        <p className="mono text-xs text-neutral-600 py-6">— none listed —</p>
      ) : shouldGroup ? (
        <div className="space-y-5">
          {buckets.map((bucket) => (
            <ScopeBucket
              key={bucket.type}
              type={bucket.type}
              items={bucket.items}
              kind={kind}
              showTypeTag={false}
            />
          ))}
        </div>
      ) : (
        <ScopeList items={items} kind={kind} showTypeTag={true} />
      )}
    </section>
  );
}

interface ScopeBucketProps {
  type: string;
  items: ScopeItem[];
  kind: 'in' | 'out';
  showTypeTag: boolean;
}

function ScopeBucket({ type, items, kind, showTypeTag }: ScopeBucketProps) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="mono text-[10px] uppercase tracking-widest text-emerald-400/80">
          {ASSET_TYPE_LABEL[type] ?? type}
        </span>
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {items.length.toString().padStart(2, '0')}
        </span>
      </div>
      <ScopeList items={items} kind={kind} showTypeTag={showTypeTag} />
    </div>
  );
}

interface ScopeListProps {
  items: ScopeItem[];
  kind: 'in' | 'out';
  showTypeTag: boolean;
}

// Long buckets get collapsed via native <details>. Threshold matches the "you can scan this
// in one glance" line — above it the wall of URLs stops being useful and the collapse wins.
const SCOPE_LIST_INLINE_LIMIT = 10;

function ScopeList({ items, kind, showTypeTag }: ScopeListProps) {
  const isIn = kind === 'in';
  const glyph = isIn ? '+' : '−';
  const glyphColor = isIn ? 'text-emerald-400' : 'text-neutral-600';

  const overflow = Math.max(0, items.length - SCOPE_LIST_INLINE_LIMIT);
  const inline = overflow > 0 ? items.slice(0, SCOPE_LIST_INLINE_LIMIT) : items;
  const rest = overflow > 0 ? items.slice(SCOPE_LIST_INLINE_LIMIT) : [];

  const renderRow = (s: ScopeItem, isLast: boolean) => {
    const href = scopeHref(s.identifier);
    const rowClass = `flex items-center gap-3 px-4 py-3 md:py-2.5 ${isLast ? '' : 'border-b border-neutral-900'} hover:bg-neutral-900/40 active:bg-neutral-900/60 transition group`;
    const display = shortenIdentifier(s.identifier);
    const body = (
      <>
        <span className={`mono text-sm ${glyphColor} shrink-0 w-3`}>{glyph}</span>
        <code
          title={display === s.identifier ? undefined : s.identifier}
          className={`mono text-xs break-all flex-1 ${href ? 'text-neutral-200 group-hover:text-emerald-300' : 'text-neutral-300'}`}
        >
          {display}
        </code>
        {href && (
          <ExternalIcon size={10} className="text-neutral-700 group-hover:text-emerald-400 shrink-0 transition" />
        )}
        {showTypeTag && (
          <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 shrink-0">{s.assetType}</span>
        )}
        {s.severity && (
          <span className="mono text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">· {s.severity}</span>
        )}
      </>
    );
    return href ? (
      <li key={s.id}>
        <a href={href} target="_blank" rel="noreferrer noopener" className={rowClass}>{body}</a>
      </li>
    ) : (
      <li key={s.id} className={rowClass}>{body}</li>
    );
  };

  return (
    <ul className={`border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 ${isIn ? '' : 'opacity-80'}`}>
      {inline.map((s, i) => renderRow(s, i === inline.length - 1 && overflow === 0))}
      {overflow > 0 && (
        <li>
          <details className="group/details">
            <summary className="mono text-[11px] uppercase tracking-widest text-neutral-500 hover:text-emerald-400 cursor-pointer list-none px-4 py-3 flex items-center gap-2 transition select-none">
              <span className="text-neutral-700 group-open/details:hidden">▸</span>
              <span className="text-neutral-700 hidden group-open/details:inline">▾</span>
              <span className="group-open/details:hidden">show <span className="text-neutral-200 tabular-nums">{overflow}</span> more</span>
              <span className="hidden group-open/details:inline">hide <span className="text-neutral-200 tabular-nums">{overflow}</span> more</span>
            </summary>
            <ul>
              {rest.map((s, i) => renderRow(s, i === rest.length - 1))}
            </ul>
          </details>
        </li>
      )}
    </ul>
  );
}
