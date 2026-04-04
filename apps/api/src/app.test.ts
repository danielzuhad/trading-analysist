import {
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  pingDatabase,
} from "@trading-analyst/db";
import { afterAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

vi.mock("@trading-analyst/db", () => ({
  closeDatabase: vi.fn(async () => undefined),
  getLatestIndicatorSnapshot: vi.fn(async () => null),
  getLatestMarketData: vi.fn(async () => null),
  pingDatabase: vi.fn(async () => undefined),
}));

const pingRedisMock = vi.fn(async () => "PONG");

vi.mock("ioredis", () => ({
  Redis: class {
    ping() {
      return pingRedisMock();
    }

    quit() {
      return Promise.resolve();
    }
  },
}));

const app = await buildApp({
  NODE_ENV: "test",
  API_HOST: "api.invalid",
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

  it("returns detailed readiness issues when Redis is unavailable", async () => {
    vi.mocked(pingDatabase).mockResolvedValueOnce(undefined);
    pingRedisMock.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:6379"), {
        code: "ECONNREFUSED",
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/readyz",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      service: "api",
      status: "degraded",
      checks: {
        database: {
          ok: true,
          target: "127.0.0.1:5432",
        },
        redis: {
          hint: "Start Redis or Docker Compose, then retry the worker and API.",
          ok: false,
          target: "127.0.0.1:6379",
        },
      },
    });
    expect(response.json().issues).toContain(
      "Redis is not reachable at 127.0.0.1:6379. The worker will keep logging connection errors until Redis is available.",
    );
  });

  it("returns the latest market snapshot when it exists", async () => {
    vi.mocked(getLatestMarketData).mockResolvedValueOnce({
      series: {
        assetId: "crypto:global:BTC-USD",
        provider: "twelve-data",
        timeframe: "1H",
        capturedAt: "2026-04-04T04:00:00.000Z",
        lastPrice: 84250.5,
        candles: [
          {
            timestamp: "2026-04-04T04:00:00.000Z",
            open: 84180.7,
            high: 84420.2,
            low: 84090.4,
            close: 84250.5,
            volume: 1310.4,
          },
        ],
        marketSession: "continuous",
        eventFlags: [],
        metadata: {},
      },
      snapshot: {
        id: "market:twelve-data:crypto:global:BTC-USD:1H",
        assetId: "crypto:global:BTC-USD",
        provider: "twelve-data",
        timeframe: "1H",
        capturedAt: "2026-04-04T04:00:00.000Z",
        lastPrice: 84250.5,
        candle: {
          open: 84180.7,
          high: 84420.2,
          low: 84090.4,
          close: 84250.5,
          volume: 1310.4,
        },
        marketSession: "continuous",
        eventFlags: [],
        metadata: {},
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/market-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=1H",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        assetId: "crypto:global:BTC-USD",
        provider: "twelve-data",
        timeframe: "1H",
      },
    });
  });

  it("returns 404 when the requested market snapshot is missing", async () => {
    vi.mocked(getLatestMarketData).mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "GET",
      url: "/market-snapshots/latest?assetId=crypto:global:ETH-USD&timeframe=4H",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: "MARKET_SNAPSHOT_NOT_FOUND",
      assetId: "crypto:global:ETH-USD",
      timeframe: "4H",
    });
  });

  it("returns the latest indicator snapshot when it exists", async () => {
    vi.mocked(getLatestIndicatorSnapshot).mockResolvedValueOnce({
      id: "indicator:crypto:global:BTC-USD:1H",
      assetId: "crypto:global:BTC-USD",
      timeframe: "1H",
      calculatedAt: "2026-04-04T04:00:00.000Z",
      movingAverages: {
        ema20: 84210.2,
        ema50: 83820.4,
        ema200: 80155.7,
      },
      oscillators: {
        rsi14: 62.4,
      },
      volatility: {
        atr14: 1210.5,
        atrPercent: 1.44,
        baseline: 1.2,
        regime: "expanded",
      },
      volume: {
        current: 1310.4,
        average20: 1180.2,
        relativeVolume: 1.11,
        trend: "up",
      },
      levels: {
        support: [83200, 82450],
        resistance: [84880, 85520],
      },
      structure: "uptrend",
      metadata: {},
    });

    const response = await app.inject({
      method: "GET",
      url: "/indicator-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=1H",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        assetId: "crypto:global:BTC-USD",
        structure: "uptrend",
        timeframe: "1H",
      },
    });
  });
});

afterAll(async () => {
  await app.close();
});
