import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/xp and lib/yoga read the shared rule files in run-club/config (outside this app folder).
  experimental: { externalDir: true },
};

export default nextConfig;
