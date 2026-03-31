import { describe, expect, it } from "vitest";
import { apiEnvSchema } from "./env.js";

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
      DATABASE_URL: "postgresql://db.example.com:5432/trading_analyst",
      REDIS_URL: "redis://127.0.0.1:6379",
    });

    expect(result.success).toBe(true);
  });
});
