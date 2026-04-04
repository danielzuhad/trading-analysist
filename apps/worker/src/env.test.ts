import { describe, expect, it } from "vitest";
import { workerEnvSchema } from "./env.js";

const validTestUrl = (service: string) => `https://${service}.invalid`;

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

  it("accepts an optional Twelve Data API key", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      DATABASE_URL: validTestUrl("database"),
      REDIS_URL: validTestUrl("redis"),
      TWELVE_DATA_API_KEY: "demo-key",
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(true);
  });
});
