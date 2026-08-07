import type { Metadata } from 'next';
import { PresetView } from '../_preset-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wildcard-Scope Bug Bounty Programs — bounty.index',
  description:
    'Bug bounty programs with wildcard scope (*.example.com). Broadest attack surface for recon and subdomain discovery.',
  alternates: { canonical: '/programs/wildcard' },
  openGraph: {
    title: 'Wildcard-Scope Bug Bounty Programs — bounty.index',
    description:
      'Programs with wildcard scope (*.example.com). Broadest attack surface for reconnaissance.',
    type: 'website',
  },
};

export default function WildcardPresetPage() {
  return (
    <PresetView
      h1="Wildcard-Scope Bug Bounty Programs"
      intro="Programs with wildcard scope (*.example.com). The broadest attack surface for reconnaissance and subdomain discovery."
      filters={{ assetType: ['wildcard'], sort: 'reward' }}
      fullFilterHref="/programs?assetType=wildcard&sort=reward"
    />
  );
}
