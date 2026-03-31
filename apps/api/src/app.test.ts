import { afterAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

vi.mock("@trading-analyst/db", () => ({
  closeDatabase: vi.fn(async () => undefined),
  pingDatabase: vi.fn(async () => undefined),
}));

vi.mock("ioredis", () => ({
  Redis: class {
    quit() {
      return Promise.resolve();
    }
  },
}));

const app = await buildApp({
  NODE_ENV: "test",
  API_HOST: "api.invalid",
  API_PORT: 3001,
  DATABASE_URL: "unused-database-connection",
  REDIS_URL: "unused-redis-connection",
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
