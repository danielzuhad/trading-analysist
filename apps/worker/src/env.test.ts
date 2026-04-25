import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import {
  loadWorkerEnv,
  shouldLoadWorkspaceEnv,
  workerEnvSchema,
} from "./env.js";

const validTestUrl = (service: string) => `https://${service}.invalid`;

function createWorkerAppDir(envContents: string): string {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), "worker-env-"));
  const appDir = path.join(workspaceRoot, "apps", "worker");

  mkdirSync(appDir, { recursive: true });
  writeFileSync(path.join(workspaceRoot, ".env.development"), envContents);

  return appDir;
}

describe("worker environment", () => {
  it("requires explicit database and redis URLs", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(false);
  });

  it("parses when redis URL is provided", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      DATABASE_URL: validTestUrl("database"),
      REDIS_URL: validTestUrl("redis"),
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(true);
  });

  it("accepts an optional CoinGecko API key", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      DATABASE_URL: validTestUrl("database"),
      REDIS_URL: validTestUrl("redis"),
      COINGECKO_API_KEY: "demo-key",
      COINGECKO_API_PLAN: "demo",
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(true);
  });

  it("accepts the paid CoinGecko Basic plan setting", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      DATABASE_URL: validTestUrl("database"),
      REDIS_URL: validTestUrl("redis"),
      COINGECKO_API_KEY: "basic-key",
      COINGECKO_API_PLAN: "basic",
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.COINGECKO_API_PLAN).toBe("basic");
  });

  it("accepts optional OpenAI settings for Sprint 6 analysis", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      DATABASE_URL: validTestUrl("database"),
      REDIS_URL: validTestUrl("redis"),
      OPENAI_API_KEY: "openai-demo-key",
      MAX_DAILY_AI_COST_USD: "2.5",
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.OPENAI_API_KEY).toBe("openai-demo-key");
    expect(result.data.MAX_DAILY_AI_COST_USD).toBe(2.5);
  });

  it("accepts optional context-provider and scheduler settings", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      DATABASE_URL: validTestUrl("database"),
      REDIS_URL: validTestUrl("redis"),
      COINGECKO_API_KEY: "cg-demo-key",
      WORKER_CONCURRENCY: 1,
      WORKER_ENABLE_SCHEDULER: "false",
      WORKER_SCHEDULED_ASSETS: "crypto:global:BTC-USD,crypto:global:ETH-USD",
      WORKER_SCHEDULED_TIMEFRAMES: "4H,1H",
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.COINGECKO_API_KEY).toBe("cg-demo-key");
    expect(result.data.COINGECKO_API_PLAN).toBe("demo");
    expect(result.data.WORKER_ENABLE_SCHEDULER).toBe(false);
  });

  it("loads infrastructure URLs from the workspace root when missing", () => {
    const appDir = createWorkerAppDir(
      `DATABASE_URL=${validTestUrl("database")}\nREDIS_URL=${validTestUrl("redis")}\n`,
    );
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      WORKER_CONCURRENCY: "1",
    };

    try {
      expect(shouldLoadWorkspaceEnv(env)).toBe(true);
      expect(
        loadWorkerEnv(undefined, {
          appDir,
          env,
        }),
      ).toEqual({
        NODE_ENV: "development",
        DATABASE_URL: validTestUrl("database"),
        REDIS_URL: validTestUrl("redis"),
        COINGECKO_API_PLAN: "demo",
        MAX_DAILY_AI_COST_USD: 2,
        WORKER_CONCURRENCY: 1,
        WORKER_ENABLE_SCHEDULER: true,
        WORKER_SCHEDULED_ASSETS:
          "crypto:global:BTC-USD,crypto:global:ETH-USD,crypto:global:SOL-USD",
        WORKER_SCHEDULED_TIMEFRAMES: "4H",
      });
    } finally {
      rmSync(path.resolve(appDir, "../.."), {
        recursive: true,
        force: true,
      });
    }
  });
});
