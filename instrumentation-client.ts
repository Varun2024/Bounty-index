import posthog from 'posthog-js';

// PostHog client init. Next.js runs this before the app hydrates (instrumentation-client is the
// supported hook). NEXT_PUBLIC_* are inlined at BUILD time, so the key must be in .env when
// `npm run deploy` builds — a wrangler runtime secret won't reach the client bundle.
// The guard means local dev without a key just no-ops instead of throwing.
if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    defaults: '2025-05-24', // auto pageviews + pageleave for App Router; no manual router tracker needed
  });
}
