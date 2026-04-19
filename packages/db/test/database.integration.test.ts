import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  getLatestSignalAggregationSnapshot,
  pingDatabase,
  runRawQuery,
  saveLatestIndicatorSnapshot,
  saveLatestMarketData,
  saveLatestSignalAggregationSnapshot,
} from "../src/index.js";

const runInfrastructureTests = process.env.RUN_INFRA_TESTS === "true";
const describeInfrastructure = runInfrastructureTests
  ? describe
  : describe.skip;
const databaseUrl = process.env.DATABASE_URL;

if (runInfrastructureTests && !databaseUrl) {
  throw new Error("DATABASE_URL is required when RUN_INFRA_TESTS=true.");
}

describeInfrastructure("database integration", () => {
  afterAll(async () => {
    await closeDatabase(databaseUrl);
  });

  it("connects and exposes the baseline migration tables", async () => {
    await pingDatabase(databaseUrl);

    const result = await runRawQuery<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public' and table_name in ($1, $2, $3, $4)
        order by table_name
      `,
      [
        "indicator_latest_snapshots",
        "market_latest_snapshots",
        "signal_aggregation_latest_snapshots",
        "service_heartbeats",
      ],
      databaseUrl,
    );

    expect(result.rows).toEqual([
      { table_name: "indicator_latest_snapshots" },
      { table_name: "market_latest_snapshots" },
      { table_name: "service_heartbeats" },
      { table_name: "signal_aggregation_latest_snapshots" },
    ]);
  });

  it("persists service heartbeat rows through the shared SQL helper", async () => {
    const serviceName = `db-test-${randomUUID()}`;

    await runRawQuery(
      `
        insert into service_heartbeats (service_name, status, payload)
        values ($1, $2, $3::jsonb)
      `,
      [serviceName, "ready", JSON.stringify({ source: "vitest" })],
      databaseUrl,
    );

    const result = await runRawQuery<{
      payload: { source: string };
      status: string;
    }>(
      `
        select status, payload
        from service_heartbeats
        where service_name = $1
      `,
      [serviceName],
      databaseUrl,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      status: "ready",
      payload: {
        source: "vitest",
      },
    });
  });

  it("upserts and reads the latest market data snapshot", async () => {
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

    const result = await getLatestMarketData(assetId, "1H", databaseUrl);

    expect(result).not.toBeNull();
    expect(result?.snapshot.id).toBe(snapshotId);
    expect(result?.series.candles).toHaveLength(1);
  });

  it("upserts and reads the latest indicator snapshot", async () => {
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

    const result = await getLatestIndicatorSnapshot(assetId, "1H", databaseUrl);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(indicatorId);
    expect(result?.structure).toBe("uptrend");
  });

  it("upserts and reads the latest signal aggregation snapshot", async () => {
    const assetId = `crypto:test:${randomUUID()}`;
    const signalId = `signal:${assetId}:1H:2026-04-04T04:00:00.000Z`;

    await saveLatestSignalAggregationSnapshot(
      {
        id: signalId,
        asset: {
          id: assetId,
          symbol: "BTC",
          displaySymbol: "BTC/USD",
          name: "Bitcoin",
          assetClass: "crypto",
          market: "global",
          exchange: "global",
          instrumentType: "spot",
          baseCurrency: "BTC",
          quoteCurrency: "USD",
          providerSymbol: "BTC/USD",
          isActive: true,
          metadata: {},
        },
        marketSnapshot: {
          id: `market:twelve-data:${assetId}:1H`,
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
        indicatorSnapshot: {
          id: `indicator:${assetId}:1H`,
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
        generatedAt: "2026-04-04T04:00:00.000Z",
        signalStrengthScore: 82,
        bias: "bullish",
        regime: "trend",
        timeframeRelevance:
          "Fast confirmation layer for crypto watchlist monitoring.",
        riskFlags: [],
        keyLevels: {
          nearestSupport: 83200,
          nearestResistance: 84880,
          invalidation: 82594.75,
        },
        labels: [
          {
            key: "trend_alignment",
            title: "Trend Alignment",
            sentiment: "bullish",
            scoreContribution: 30,
            details:
              "Price holds above a fully bullish EMA20/EMA50/EMA200 stack.",
          },
        ],
        summary: "Bullish trend context led by trend alignment and structure.",
        snapshotHash: "signal-hash-btc-1h",
        metadata: {
          signalAggregationVersion: "signal-aggregation:v1",
        },
      },
      databaseUrl,
    );

    const result = await getLatestSignalAggregationSnapshot(
      assetId,
      "1H",
      databaseUrl,
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe(signalId);
    expect(result?.signalStrengthScore).toBe(82);
    expect(result?.bias).toBe("bullish");
  });
});
