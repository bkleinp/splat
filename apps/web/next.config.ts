import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root (Next runs with cwd = apps/web). Without this, a stray
  // lockfile higher up (e.g. in the user's home folder) gets picked as the root.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  // @splat/llm ships TypeScript source; let Next compile it.
  transpilePackages: ["@splat/llm"],
};

export default nextConfig;
