import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a lockfile/node_modules in a parent directory
  // can never change module resolution (duplicate React = broken build).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
