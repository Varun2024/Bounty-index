// schema.org JSON-LD builders. Pure functions over live stats — no hardcoded counts,
// so what crawlers and answer engines read always matches the index. Numbers come from
// stats()/topPayouts(); callers pass them in.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';

const PLATFORM_NAMES = 'HackerOne, Bugcrowd, Intigriti, YesWeHack, Immunefi, HackenProof, and Federacy';

interface DatasetStats {
  programs: number;
  bountyPrograms: number;
  inScopeAssets: number;
  platforms: number;
  lastIngestAt: Date | null;
}

// A Dataset + downloadable distributions. The export endpoints are the machine-readable
// copy (CSV/JSON), which is the strongest signal to Google Dataset Search and to AI engines
// that this is a source of record, not a content page.
export function datasetLd(s: DatasetStats): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'bounty.index: public bug bounty programs',
    description:
      `A continuously updated index of ${s.programs.toLocaleString()} public bug bounty and ` +
      `vulnerability disclosure programs across ${s.platforms} platforms (${PLATFORM_NAMES}), ` +
      `covering ${s.inScopeAssets.toLocaleString()} in-scope assets. ` +
      `${s.bountyPrograms.toLocaleString()} pay cash rewards. Filterable by scope, asset type, and payout.`,
    url: `${SITE_URL}/programs`,
    keywords: [
      'bug bounty',
      'bug bounty programs',
      'vulnerability disclosure',
      'security research',
      'attack surface',
      'scope',
      'safe harbor',
    ],
    creator: { '@type': 'Organization', name: 'bounty.index', url: SITE_URL },
    isAccessibleForFree: true,
    ...(s.lastIngestAt ? { dateModified: new Date(s.lastIngestAt).toISOString() } : {}),
    variableMeasured: [
      'program name',
      'platform',
      'payout range',
      'in-scope assets',
      'asset type',
      'safe harbor',
      'program type',
    ],
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        contentUrl: `${SITE_URL}/api/export/programs?format=csv`,
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${SITE_URL}/api/export/programs?format=json`,
      },
    ],
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqLd(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}

interface PlatformCollectionInput {
  platformLabel: string;
  platformId: string;
  total: number;
  programs: Array<{ name: string; slug: string }>;
}

// CollectionPage + ItemList for a platform hub. Tells Google/AI engines "this page is a list of
// N named programs" — the signal that wins "Intigriti programs list" style queries. itemListElement
// is capped so a 2k-program platform doesn't inline a huge JSON blob; numberOfItems still carries the
// true total. ponytail: 100 is plenty for the signal; the visible page already links every program.
const MAX_ITEMLIST = 100;
export function platformCollectionLd(input: PlatformCollectionInput): Record<string, unknown> {
  const { platformLabel, platformId, total, programs } = input;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${platformLabel} bug bounty programs`,
    description:
      `A list of ${total.toLocaleString()} public ${platformLabel} bug bounty and vulnerability ` +
      `disclosure programs, with scope and payout data, updated daily.`,
    url: `${SITE_URL}/platforms/${platformId}`,
    isPartOf: { '@type': 'WebSite', name: 'bounty.index', url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: programs.slice(0, MAX_ITEMLIST).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.name,
        url: `${SITE_URL}/programs/${platformId}/${p.slug}`,
      })),
    },
  };
}

export function jsonLdScript(data: Record<string, unknown>): string {
  // Escape </script> so the JSON can't break out of the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
