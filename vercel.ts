import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    // ponytail: Hobby plan caps at daily. Upgrade to Pro → switch back to '0 * * * *'.
    { path: '/api/cron/ingest', schedule: '0 6 * * *' },
  ],
};
