import type { Metadata } from 'next';
import { PresetView } from '../_preset-view';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Bug Bounty Programs with Safe Harbor · bounty.index',
  description:
    'Bug bounty programs with a confirmed safe-harbor clause protecting good-faith security research. Ranked by max payout.',
  alternates: { canonical: '/programs/safe-harbor' },
  openGraph: {
    title: 'Bug Bounty Programs with Safe Harbor · bounty.index',
    description:
      'Bug bounty programs with a confirmed safe-harbor clause. Legal protection for good-faith security research.',
    type: 'website',
  },
};

export default function SafeHarborPresetPage() {
  return (
    <PresetView
      h1="Bug Bounty Programs with Safe Harbor"
      answer={(n) => `${n.toLocaleString()} public bug bounty programs publish a confirmed safe-harbor clause protecting good-faith security research from legal action.`}
      intro="Programs with a confirmed safe-harbor clause protecting good-faith security research. Coverage is currently strongest for Bugcrowd; other platforms don't publish this field structurally yet."
      filters={{ safeHarbor: true, sort: 'reward' }}
      fullFilterHref="/programs?safeHarbor=1&sort=reward"
    />
  );
}
