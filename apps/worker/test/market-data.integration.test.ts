import { randomUUID } from "node:crypto";
import {
  closeDatabase,
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  type LatestMarketData,
  listLatestSignalAggregationSnapshots,
} from "@trading-analyst/db";
import type { IndicatorSnapshot } from "@trading-analyst/shared-types";
import { afterAll, describe, expect, it } from "vitest";
import { processMarketSnapshotJob } from "../src/market-data.js";

const runInfrastructureTests = process.env.RUN_INFRA_TESTS === "true";
const describeInfrastructure = runInfrastructureTests
  ? describe
  : describe.skip;
const requireDatabaseUrl = () => {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error("DATABASE_URL is required when RUN_INFRA_TESTS=true.");
  }

  return value;
};

describeInfrastructure("worker market-data persistence", () => {
  afterAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      await closeDatabase(databaseUrl);
    }
  });

  it("persists market, indicator, and signal aggregation snapshots", async () => {
    const assetId = "crypto:global:BTC-USD";
    const databaseUrl = requireDatabaseUrl();
    const uniqueSuffix = randomUUID();
    const marketSnapshotId = `market:twelve-data:${assetId}:1H`;
    const indicatorSnapshotId = `indicator:${assetId}:1H`;

    const marketDataFixture: LatestMarketData = {
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
        metadata: {
          uniqueSuffix,
        },
      },
      snapshot: {
        id: marketSnapshotId,
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
        metadata: {
          uniqueSuffix,
        },
      },
    };

    const indicatorFixture: IndicatorSnapshot = {
      id: indicatorSnapshotId,
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
      metadata: {
        uniqueSuffix,
      },
    };

    const result = await processMarketSnapshotJob({
      apiKey: "test-key",
      assetId,
      buildIndicator: () => indicatorFixture,
      connectionString: databaseUrl,
      fetchService: {
        fetchMarketData: async () => marketDataFixture,
      },
      logger: {
        error: console.error,
        log: console.log,
        warn: console.warn,
      },
      requestedAt: "2026-04-04T04:00:00.000Z",
      timeframe: "1H",
    });

    if (result.status !== "stored") {
      throw new Error(`Expected stored result, received ${result.status}.`);
    }

    expect(result.snapshotId).toBe(marketSnapshotId);
    expect(result.indicatorSnapshotId).toBe(indicatorSnapshotId);

    const persistedMarketData = await getLatestMarketData(
      assetId,
      "1H",
      databaseUrl,
    );
    const persistedIndicator = await getLatestIndicatorSnapshot(
      assetId,
      "1H",
      databaseUrl,
    );
    const persistedSignalSnapshots =
      await listLatestSignalAggregationSnapshots(databaseUrl);
    const persistedSignalSnapshot = persistedSignalSnapshots.find(
      (snapshot) => snapshot.id === result.signalSnapshotId,
    );

    expect(persistedMarketData?.snapshot.id).toBe(marketSnapshotId);
    expect(persistedMarketData?.snapshot.metadata).toMatchObject({
      uniqueSuffix,
    });
    expect(persistedIndicator?.id).toBe(indicatorSnapshotId);
    expect(persistedIndicator?.metadata).toMatchObject({
      uniqueSuffix,
    });
    expect(persistedSignalSnapshot).toBeDefined();
    expect(persistedSignalSnapshot?.signalStrengthScore).toBeGreaterThan(0);
    expect(persistedSignalSnapshot?.asset.id).toBe(assetId);
    expect(persistedSignalSnapshot?.marketSnapshot.metadata).toMatchObject({
      uniqueSuffix,
    });
  });
});
