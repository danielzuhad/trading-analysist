import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { apiEnvSchema, loadApiEnv, shouldLoadWorkspaceEnv } from "./env.js";

const validTestUrl = (service: string) => `https://${service}.invalid`;

function createApiAppDir(envContents: string): string {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), "api-env-"));
  const appDir = path.join(workspaceRoot, "apps", "api");

  mkdirSync(appDir, { recursive: true });
  writeFileSync(path.join(workspaceRoot, ".env.development"), envContents);

  return appDir;
}

describe("api environment", () => {
  it("requires database and redis URLs", () => {
    const result = apiEnvSchema.safeParse({
      NODE_ENV: "development",
      API_HOST: "0.0.0.0",
      API_PORT: 3001,
    });

    expect(result.success).toBe(false);
  });

  it("parses when explicit infrastructure URLs are provided", () => {
    const result = apiEnvSchema.safeParse({
      NODE_ENV: "development",
      API_HOST: "0.0.0.0",
      API_PORT: 3001,
      DATABASE_URL: validTestUrl("database"),
      REDIS_URL: validTestUrl("redis"),
    });

    expect(result.success).toBe(true);
  });

  it("loads infrastructure URLs from the workspace root when missing", () => {
    const appDir = createApiAppDir(
      `DATABASE_URL=${validTestUrl("database")}\nREDIS_URL=${validTestUrl("redis")}\n`,
    );
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      API_HOST: "0.0.0.0",
      API_PORT: "3001",
    };

    try {
      expect(shouldLoadWorkspaceEnv(env)).toBe(true);
      expect(
        loadApiEnv(undefined, {
          appDir,
          env,
        }),
      ).toEqual({
        NODE_ENV: "development",
        API_HOST: "0.0.0.0",
        API_PORT: 3001,
        COINGECKO_API_PLAN: "demo",
        DATABASE_URL: validTestUrl("database"),
        REDIS_URL: validTestUrl("redis"),
      });
    } finally {
      rmSync(path.resolve(appDir, "../.."), {
        recursive: true,
        force: true,
      });
    }
  });
});
