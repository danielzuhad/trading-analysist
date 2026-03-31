import { describe, expect, it } from "vitest";
import { workerEnvSchema } from "./env.js";

const validTestUrl = (service: string) => `https://${service}.invalid`;

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
      REDIS_URL: validTestUrl("redis"),
      WORKER_CONCURRENCY: 1,
    });

    expect(result.success).toBe(true);
  });
});
