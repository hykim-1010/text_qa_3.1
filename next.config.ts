import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['playwright', 'playwright-core'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
