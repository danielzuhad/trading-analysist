import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const runInfrastructureTests = process.env.RUN_INFRA_TESTS === "true";
const describeInfrastructure = runInfrastructureTests
  ? describe
  : describe.skip;
const requireEnv = (name: "DATABASE_URL" | "REDIS_URL") => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required when RUN_INFRA_TESTS=true.`);
  }

  return value;
};

describeInfrastructure("api readiness route", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      NODE_ENV: "test",
      API_HOST: "api.invalid",
      API_PORT: 3001,
      DATABASE_URL: requireEnv("DATABASE_URL"),
      REDIS_URL: requireEnv("REDIS_URL"),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports ready when PostgreSQL and Redis are reachable", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/readyz",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "api",
      status: "ready",
      checks: {
        database: true,
        redis: true,
      },
    });
  });
});
