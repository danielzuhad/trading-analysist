import type { NextConfig } from "next";

import { ensureWorkspaceEnvLoaded } from "./env";

// Allow `apps/web` to run directly in the monorepo while still reading root `.env*`.
ensureWorkspaceEnvLoaded();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
