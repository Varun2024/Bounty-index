import { NextRequest, NextResponse } from 'next/server';
import { listPrograms, type ProgramFilters } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const EXPORT_LIMIT = 5000;

function parseArray(v: string | null): string[] {
  if (!v) return [];
  return v.split(',').filter(Boolean);
}

function buildFilters(sp: URLSearchParams): ProgramFilters {
  return {
    q: sp.get('q') || undefined,
    platform: parseArray(sp.get('platform')),
    assetType: parseArray(sp.get('assetType')),
    programType: sp.get('programType') || 'all',
    hasBounty: sp.get('hasBounty') === '1',
    safeHarbor: sp.get('safeHarbor') === '1',
    minReward: sp.get('minReward') ? Number(sp.get('minReward')) : undefined,
    sort: (sp.get('sort') as ProgramFilters['sort']) ?? 'reward',
    page: 1,
    pageSize: EXPORT_LIMIT,
  };
}

// Columns exposed in the export. Skipping `raw` (huge JSONB) and `searchText` (denormalized).
const COLUMNS = [
  'id',
  'platform',
  'slug',
  'name',
  'handle',
  'url',
  'programType',
  'offersBounty',
  'offersSwag',
  'managed',
  'minBounty',
  'maxBounty',
  'currency',
  'submissionState',
  'safeHarbor',
  'firstSeenAt',
  'lastUpdatedAt',
] as const;

type Row = Awaited<ReturnType<typeof listPrograms>>['rows'][number];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  // Wrap in quotes if the value has a comma, quote, newline, or leading/trailing space.
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Row[]): string {
  const header = COLUMNS.join(',');
  const lines = rows.map((r) => COLUMNS.map((c) => csvEscape(r[c])).join(','));
  return [header, ...lines].join('\n');
}

function toJson(rows: Row[]): string {
  // Project down to the same column subset so JSON and CSV stay symmetric.
  return JSON.stringify(
    rows.map((r) => Object.fromEntries(COLUMNS.map((c) => [c, r[c]]))),
    null,
    2,
  );
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format = (sp.get('format') ?? 'csv').toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json({ error: 'format must be csv or json' }, { status: 400 });
  }

  const filters = buildFilters(sp);
  const { rows, total } = await listPrograms(filters);

  const stamp = new Date().toISOString().slice(0, 10);
  const truncated = total > rows.length;
  const filename = `bounty-index-programs-${stamp}.${format}`;

  const body = format === 'csv' ? toCsv(rows) : toJson(rows);
  const contentType = format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Total-Matched': String(total),
      'X-Exported-Rows': String(rows.length),
      'X-Truncated': truncated ? '1' : '0',
      'Cache-Control': 'no-store',
    },
  });
}
