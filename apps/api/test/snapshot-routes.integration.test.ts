import { randomUUID } from "node:crypto";
import {
  getLatestAssetAnalysis,
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  getLatestSignalAggregationSnapshot,
  saveLatestAssetAnalysis,
  saveLatestIndicatorSnapshot,
  saveLatestMarketData,
  saveLatestSignalAggregationSnapshot,
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

  it("returns the latest signal snapshot from PostgreSQL", async () => {
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

    const response = await app.inject({
      method: "GET",
      url: `/signal-snapshots/latest?assetId=${assetId}&timeframe=1H`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        id: signalId,
        signalStrengthScore: 82,
        bias: "bullish",
      },
    });

    const persisted = await getLatestSignalAggregationSnapshot(
      assetId,
      "1H",
      databaseUrl,
    );
    expect(persisted?.id).toBe(signalId);
  });

  it("returns the latest asset analysis snapshot from PostgreSQL", async () => {
    const assetId = `crypto:test:${randomUUID()}`;
    const analysisId = `analysis:latest:${assetId}:1H`;

    await saveLatestAssetAnalysis(
      {
        id: analysisId,
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
          capturedAt: "2026-04-19T08:00:00.000Z",
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
          calculatedAt: "2026-04-19T08:00:00.000Z",
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
        state: "ACTIONABLE",
        suggestion: "ENTRY_ON_CONFIRMATION",
        summary:
          "Trend remains constructive, but confirmation is still required.",
        decisionCard: {
          summary:
            "Trend remains constructive, but confirmation is still required.",
          keyReasons: ["EMA alignment remains bullish."],
          actionPlan: ["Wait for a decisive close above nearby resistance."],
          executionMethod:
            "Enter after breakout confirmation above resistance.",
          invalidation: "Stand aside if price loses the nearest support.",
          riskLevel: "medium",
        },
        regime: "trend",
        bias: "bullish",
        signalStrengthScore: 82,
        aiConfidence: 78,
        concerns: ["Resistance remains close overhead."],
        suggestedPositionSize: "conservative",
        timeframeRelevance:
          "Fast confirmation layer for crypto watchlist monitoring.",
        riskFlags: ["Resistance remains close overhead."],
        keyLevels: {
          nearestSupport: 83200,
          nearestResistance: 84880,
          invalidation: 82594.75,
        },
        modelUsed: "gpt-4o-mini",
        promptVersion: "ai-analysis:v1",
        snapshotHash: "signal-hash-btc-1h",
        aiLatencyMs: 915,
        costEstimateUsd: 0.0003,
        generatedAt: "2026-04-19T08:05:00.000Z",
        triggeredBy: "manual_recalculation",
        metadata: {
          signalAggregationSnapshotId: `signal:${assetId}:1H:2026-04-19T08:00:00.000Z`,
        },
      },
      databaseUrl,
    );

    const response = await app.inject({
      method: "GET",
      url: `/asset-analyses/latest?assetId=${assetId}&timeframe=1H`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        id: analysisId,
        state: "ACTIONABLE",
        aiConfidence: 78,
      },
    });

    const persisted = await getLatestAssetAnalysis(assetId, "1H", databaseUrl);
    expect(persisted?.id).toBe(analysisId);
  });
});
