import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.launchleague.xyz' },
    ],
  },
};

export default nextConfig;
