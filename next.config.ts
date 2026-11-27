import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.launchleague.xyz' },
    ],
  },
};

export default nextConfig;

// Makes Cloudflare bindings available during `next dev` (OpenNext adapter).
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
