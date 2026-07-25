import { afterAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { isAuthorizedBearerHeader, isPublicApiPath } from "./auth.js";

vi.mock("@trading-analyst/db", () => ({
  addWatchlistAsset: vi.fn(async () => ({ status: "created" })),
  closePosition: vi.fn(async () => null),
  closeDatabase: vi.fn(async () => undefined),
  createPosition: vi.fn(async () => null),
  ensureDefaultWatchlistAssets: vi.fn(async () => undefined),
  getWatchlistAsset: vi.fn(async () => null),
  getWatchlistAssetBySymbol: vi.fn(async () => null),
  listWatchlistAssets: vi.fn(async () => []),
  removeWatchlistAsset: vi.fn(async () => ({ status: "not_found" })),
  getActivePositionForAsset: vi.fn(async () => null),
  getAnalysisQualitySummary: vi.fn(async () => ({
    buckets: [],
    evaluatedCount: 0,
    pendingCount: 0,
  })),
  getLatestAssetAnalysis: vi.fn(async () => null),
  getLatestIndicatorSnapshot: vi.fn(async () => null),
  getLatestMarketData: vi.fn(async () => null),
  getLatestSignalAggregationSnapshot: vi.fn(async () => null),
  listAlerts: vi.fn(async () => []),
  listPositions: vi.fn(async () => []),
  listServiceHeartbeats: vi.fn(async () => []),
  pingDatabase: vi.fn(async () => undefined),
  updatePosition: vi.fn(async () => null),
}));

vi.mock("ioredis", () => ({
  Redis: class {
    ping() {
      return Promise.resolve("PONG");
    }

    quit() {
      return Promise.resolve();
    }
  },
}));

const authToken = "test-api-auth-token-0123456789abcdef";
const app = await buildApp({
  NODE_ENV: "test",
  API_AUTH_TOKEN: authToken,
  API_HOST: "api.invalid",
  API_PORT: 3001,
  COINGECKO_API_PLAN: "demo",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
  REDIS_URL: "redis://127.0.0.1:6379",
});

afterAll(async () => {
  await app.close();
});

describe("isPublicApiPath", () => {
  it("keeps health and webhook paths public", () => {
    expect(isPublicApiPath("/health")).toBe(true);
    expect(isPublicApiPath("/readyz")).toBe(true);
    expect(isPublicApiPath("/chat-layer/twilio/webhook")).toBe(true);
  });

  it("protects data routes", () => {
    expect(isPublicApiPath("/alerts")).toBe(false);
    expect(isPublicApiPath("/positions")).toBe(false);
    expect(isPublicApiPath("/watchlist/overview")).toBe(false);
    expect(isPublicApiPath("/analysis-quality")).toBe(false);
  });
});

describe("isAuthorizedBearerHeader", () => {
  it("accepts the expected bearer token", () => {
    expect(isAuthorizedBearerHeader(`Bearer ${authToken}`, authToken)).toBe(
      true,
    );
  });

  it("rejects missing, malformed, or wrong tokens", () => {
    expect(isAuthorizedBearerHeader(undefined, authToken)).toBe(false);
    expect(isAuthorizedBearerHeader("Bearer ", authToken)).toBe(false);
    expect(isAuthorizedBearerHeader(authToken, authToken)).toBe(false);
    expect(isAuthorizedBearerHeader("Bearer wrong-token", authToken)).toBe(
      false,
    );
  });
});

describe("api auth guard", () => {
  it("rejects protected routes without a token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/alerts",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "UNAUTHORIZED" });
  });

  it("rejects protected routes with a wrong token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/positions",
      headers: {
        authorization: "Bearer definitely-not-the-right-token",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("allows protected routes with the configured token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/alerts",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ alerts: [], count: 0 });
  });

  it("keeps health endpoints public", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
  });
});
