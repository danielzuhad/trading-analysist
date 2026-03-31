import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const app = await buildApp({
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: 3001,
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
  REDIS_URL: "redis://127.0.0.1:6379",
});

describe("api health routes", () => {
  it("returns a basic health payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "api",
      status: "ok",
      environment: "test",
    });
  });
});

afterAll(async () => {
  await app.close();
});
