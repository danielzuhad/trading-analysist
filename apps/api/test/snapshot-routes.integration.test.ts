import { randomUUID } from "node:crypto";
import {
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  saveLatestIndicatorSnapshot,
  saveLatestMarketData,
} from "@trading-analyst/db";
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

describeInfrastructure("api snapshot routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let databaseUrl: string;

  beforeAll(async () => {
    databaseUrl = requireEnv("DATABASE_URL");

    app = await buildApp({
      NODE_ENV: "test",
      API_HOST: "api.invalid",
      API_PORT: 3001,
      DATABASE_URL: databaseUrl,
      REDIS_URL: requireEnv("REDIS_URL"),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the latest market snapshot from PostgreSQL", async () => {
    const assetId = `crypto:test:${randomUUID()}`;
    const snapshotId = `market:twelve-data:${assetId}:1H`;

    await saveLatestMarketData(
      {
        series: {
          assetId,
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
          id: snapshotId,
          assetId,
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
      },
      databaseUrl,
    );

    const response = await app.inject({
      method: "GET",
      url: `/market-snapshots/latest?assetId=${assetId}&timeframe=1H`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        assetId,
        id: snapshotId,
      },
    });

    const persisted = await getLatestMarketData(assetId, "1H", databaseUrl);
    expect(persisted?.snapshot.id).toBe(snapshotId);
  });

  it("returns the latest indicator snapshot from PostgreSQL", async () => {
    const assetId = `crypto:test:${randomUUID()}`;
    const indicatorId = `indicator:${assetId}:1H`;

    await saveLatestIndicatorSnapshot(
      {
        id: indicatorId,
        assetId,
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
      },
      databaseUrl,
    );

    const response = await app.inject({
      method: "GET",
      url: `/indicator-snapshots/latest?assetId=${assetId}&timeframe=1H`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        assetId,
        id: indicatorId,
        structure: "uptrend",
      },
    });

    const persisted = await getLatestIndicatorSnapshot(
      assetId,
      "1H",
      databaseUrl,
    );
    expect(persisted?.id).toBe(indicatorId);
  });
});
