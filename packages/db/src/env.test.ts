import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { ensureWorkspaceEnvLoaded, shouldLoadWorkspaceEnv } from "./env.js";

const validDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:5432/test_db";

function createDbPackageDir(envContents: string): string {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), "db-env-"));
  const packageDir = path.join(workspaceRoot, "packages", "db");

  mkdirSync(packageDir, { recursive: true });
  writeFileSync(path.join(workspaceRoot, ".env.development"), envContents);

  return packageDir;
}

describe("database workspace environment", () => {
  it("detects when DATABASE_URL still needs to be loaded", () => {
    expect(
      shouldLoadWorkspaceEnv({
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });

  it("loads DATABASE_URL from the workspace root when missing", () => {
    const packageDir = createDbPackageDir(`DATABASE_URL=${validDatabaseUrl}\n`);
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
    };

    try {
      expect(ensureWorkspaceEnvLoaded({ env, packageDir })).toBe(true);
      expect(env.DATABASE_URL).toBe(validDatabaseUrl);
    } finally {
      rmSync(path.resolve(packageDir, "../.."), {
        recursive: true,
        force: true,
      });
    }
  });

  it("keeps an explicit DATABASE_URL without overriding it from workspace files", () => {
    const packageDir = createDbPackageDir(`DATABASE_URL=${validDatabaseUrl}\n`);
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://override:override@127.0.0.1:5432/override_db",
    };

    try {
      expect(ensureWorkspaceEnvLoaded({ env, packageDir })).toBe(false);
      expect(env.DATABASE_URL).toBe(
        "postgresql://override:override@127.0.0.1:5432/override_db",
      );
    } finally {
      rmSync(path.resolve(packageDir, "../.."), {
        recursive: true,
        force: true,
      });
    }
  });
});
