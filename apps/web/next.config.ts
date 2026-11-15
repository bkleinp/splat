import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root (Next runs with cwd = apps/web). Without this, a stray
  // lockfile higher up (e.g. in the user's home folder) gets picked as the root.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  // @splat/llm ships TypeScript source; let Next compile it.
  transpilePackages: ["@splat/llm"],
  // No Next.js "N" badge in the corner during development.
  devIndicators: false,
  // Homes moved from /house/<slug> to /<slug>, and house-3 became singlefloor: keep old links working.
  async redirects() {
    return [
      { source: "/house/house-3", destination: "/singlefloor", permanent: false },
      { source: "/house/house-3/admin", destination: "/singlefloor/admin", permanent: false },
      { source: "/house/:slug", destination: "/:slug", permanent: false },
      { source: "/house/:slug/admin", destination: "/:slug/admin", permanent: false },
    ];
  },
};

export default nextConfig;
