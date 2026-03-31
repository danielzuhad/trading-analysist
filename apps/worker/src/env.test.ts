import { describe, expect, it } from "vitest";
import { workerEnvSchema } from "./env.js";

describe("worker environment", () => {
  it("requires an explicit redis URL", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(false);
  });

  it("parses when redis URL is provided", () => {
    const result = workerEnvSchema.safeParse({
      NODE_ENV: "development",
      REDIS_URL: "redis://127.0.0.1:6379",
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(true);
  });
});
