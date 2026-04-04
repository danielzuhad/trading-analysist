import { getLatestMarketData } from "@trading-analyst/db";
import { afterAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

vi.mock("@trading-analyst/db", () => ({
  closeDatabase: vi.fn(async () => undefined),
  getLatestMarketData: vi.fn(async () => null),
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
});

afterAll(async () => {
  await app.close();
});
