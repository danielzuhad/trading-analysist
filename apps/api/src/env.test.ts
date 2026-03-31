import { describe, expect, it } from "vitest";
import { apiEnvSchema } from "./env.js";

const validTestUrl = (service: string) => `https://${service}.invalid`;

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
});
