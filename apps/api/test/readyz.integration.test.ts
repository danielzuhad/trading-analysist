import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const runInfrastructureTests = process.env.RUN_INFRA_TESTS === "true";
const describeInfrastructure = runInfrastructureTests
  ? describe
  : describe.skip;

describeInfrastructure("api readiness route", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      NODE_ENV: "test",
      API_HOST: "127.0.0.1",
      API_PORT: 3001,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
      REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
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
