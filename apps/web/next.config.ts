import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

import { ensureWorkspaceEnvLoaded } from "./env";

// Allow `apps/web` to run directly in the monorepo while still reading root `.env*`.
ensureWorkspaceEnvLoaded();

const webAppDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(webAppDir, "../..");
const sharedTypesBuildEntry = path
  .relative(
    webAppDir,
    path.join(workspaceRoot, "packages/shared-types/dist/index.js"),
  )
  .replaceAll(path.sep, "/");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      "@trading-analyst/shared-types": sharedTypesBuildEntry,
    },
  },
};

export default nextConfig;
