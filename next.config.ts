import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
      },
    ],
    // Increase cache TTL to reduce re-fetching
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
    // Set reasonable timeouts
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
