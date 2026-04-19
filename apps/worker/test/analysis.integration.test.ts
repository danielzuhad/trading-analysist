import { randomUUID } from "node:crypto";
import {
  closeDatabase,
  getLatestAssetAnalysis,
  saveLatestSignalAggregationSnapshot,
} from "@trading-analyst/db";
import { afterAll, describe, expect, it } from "vitest";
import { generateLatestAssetAnalysis } from "../src/analysis.js";

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

describeInfrastructure("worker AI analysis persistence", () => {
  afterAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      await closeDatabase(databaseUrl);
    }
  });

  it("loads a stored signal snapshot and persists the generated latest AI analysis", async () => {
    const assetId = `crypto:test:${randomUUID()}`;
    const databaseUrl = requireDatabaseUrl();

    await saveLatestSignalAggregationSnapshot(
      {
        id: `signal:${assetId}:1H:2026-04-19T08:00:00.000Z`,
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
        generatedAt: "2026-04-19T08:00:00.000Z",
        signalStrengthScore: 82,
        bias: "bullish",
        regime: "trend",
        timeframeRelevance:
          "Fast confirmation layer for crypto watchlist monitoring.",
        riskFlags: ["Resistance remains close overhead."],
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
        snapshotHash: `signal-hash-${assetId}`,
        metadata: {
          signalAggregationVersion: "signal-aggregation:v1",
        },
      },
      databaseUrl,
    );

    const result = await generateLatestAssetAnalysis({
      assetId,
      connectionString: databaseUrl,
      provider: async () => ({
        aiLatencyMs: 840,
        modelUsed: "gpt-4o-mini",
        output: {
          state: "ACTIONABLE",
          suggestion: "ENTRY_ON_CONFIRMATION",
          summary:
            "Trend remains constructive, but confirmation is still required.",
          keyReasons: ["EMA alignment remains bullish."],
          concerns: ["Resistance remains close overhead."],
          actionPlan: ["Wait for a decisive close above nearby resistance."],
          executionMethod:
            "Enter after breakout confirmation above resistance.",
          invalidation: "Stand aside if price loses the nearest support.",
          riskLevel: "medium",
          suggestedPositionSize: "conservative",
          aiConfidence: 78,
        },
        usage: {
          cachedInputTokens: 0,
          inputTokens: 1000,
          outputTokens: 250,
        },
      }),
      timeframe: "1H",
    });

    expect(result).toMatchObject({
      assetId,
      state: "ACTIONABLE",
      status: "stored",
      timeframe: "1H",
    });

    const persisted = await getLatestAssetAnalysis(assetId, "1H", databaseUrl);
    expect(persisted?.state).toBe("ACTIONABLE");
    expect(persisted?.modelUsed).toBe("gpt-4o-mini");
  });
});
