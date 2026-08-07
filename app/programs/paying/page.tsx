import type { Metadata } from 'next';
import { PresetView } from '../_preset-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Paying Bug Bounty Programs — bounty.index',
  description:
    'Every public bug bounty program that pays cash rewards, ranked by max payout. Filterable by platform, asset type, and safe harbor.',
  alternates: { canonical: '/programs/paying' },
  openGraph: {
    title: 'Paying Bug Bounty Programs — bounty.index',
    description:
      'Every public bug bounty program that pays cash rewards, ranked by max reward.',
    type: 'website',
  },
};

export default function PayingPresetPage() {
  return (
    <PresetView
      h1="Paying Bug Bounty Programs"
      intro="Every public bug bounty program that pays cash rewards, ranked by max payout. Filter further by platform, asset type, or safe-harbor status."
      filters={{ hasBounty: true, sort: 'reward' }}
      fullFilterHref="/programs?hasBounty=1&sort=reward"
    />
  );
}
