import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  // Cron paused until ~Oct 5 CPU quota resets. Re-add after reset:
  // { path: '/api/cron/ingest', schedule: '0 6 * * *' }
  crons: [],
};
