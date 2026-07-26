import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ensureWorkspaceEnvLoaded,
  loadWebEnv,
  shouldLoadWorkspaceEnv,
} from "./env";

type MutableEnv = Record<string, string | undefined>;

const env: MutableEnv = {};
const originalNodeEnv = process.env.NODE_ENV;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function createWebAppDir(envContents: string): string {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), "web-env-"));
  const webAppDir = path.join(workspaceRoot, "apps", "web");

  mkdirSync(webAppDir, { recursive: true });
  writeFileSync(path.join(workspaceRoot, ".env.development"), envContents);

  return webAppDir;
}

afterEach(() => {
  env.NODE_ENV = originalNodeEnv;
  env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
});

describe("web environment loading", () => {
  it("loads the API base URL from the workspace root when missing", () => {
    const webAppDir = createWebAppDir(
      "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001\n",
    );

    env.NODE_ENV = "development";
    delete env.NEXT_PUBLIC_API_BASE_URL;

    try {
      expect(shouldLoadWorkspaceEnv(env)).toBe(true);
      expect(ensureWorkspaceEnvLoaded({ appDir: webAppDir, env })).toBe(true);
      expect(env.NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:3001");
    } finally {
      rmSync(path.resolve(webAppDir, "../.."), {
        recursive: true,
        force: true,
      });
    }
  });

  it("keeps an existing API base URL intact", () => {
    const webAppDir = createWebAppDir(
      "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001\n",
    );

    env.NODE_ENV = "development";
    env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:9999";

    try {
      expect(shouldLoadWorkspaceEnv(env)).toBe(false);
      expect(ensureWorkspaceEnvLoaded({ appDir: webAppDir, env })).toBe(false);
      expect(env.NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:9999");
    } finally {
      rmSync(path.resolve(webAppDir, "../.."), {
        recursive: true,
        force: true,
      });
    }
  });

  it("reads the public API base URL through the web env helper", () => {
    const webAppDir = createWebAppDir(
      "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001\n",
    );

    env.NODE_ENV = "development";
    delete env.NEXT_PUBLIC_API_BASE_URL;

    try {
      expect(loadWebEnv(undefined, { appDir: webAppDir, env })).toEqual({
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001",
      });
    } finally {
      rmSync(path.resolve(webAppDir, "../.."), {
        recursive: true,
        force: true,
      });
    }
  });
});
