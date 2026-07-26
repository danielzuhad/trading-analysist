import type {
  LatestAssetAnalysis,
  SignalAggregationSnapshot,
} from "@trading-analyst/shared-types";
import { describe, expect, it, vi } from "vitest";
import {
  evaluateThresholdApproach,
  getThresholdReanalysisCooldownMs,
  processThresholdCheckJob,
} from "./thresholds.js";

const assetId = "crypto:global:BTC-USD";
const requestedAt = "2026-06-04T09:00:00.000Z";

const latestAnalysisFixture: LatestAssetAnalysis = {
  id: "analysis:latest:crypto:global:BTC-USD:4H",
  asset: {
    assetClass: "crypto",
    baseCurrency: "BTC",
    displaySymbol: "BTC/USD",
    exchange: "global",
    id: assetId,
    instrumentType: "spot",
    isActive: true,
    market: "global",
    metadata: {
      coingeckoCoinId: "bitcoin",
    },
    name: "Bitcoin",
    providerSymbol: "BTC/USD",
    quoteCurrency: "USD",
    symbol: "BTC",
  },
  marketSnapshot: {
    assetId,
    candle: {
      close: 84_250.5,
      high: 84_420.2,
      low: 84_090.4,
      open: 84_180.7,
      volume: 1_310.4,
    },
    capturedAt: "2026-06-04T07:00:00.000Z",
    eventFlags: [],
    id: "market:coingecko:crypto:global:BTC-USD:4H",
    lastPrice: 84_250.5,
    marketSession: "continuous",
    metadata: {},
    provider: "coingecko",
    timeframe: "4H",
  },
  indicatorSnapshot: {
    assetId,
    calculatedAt: "2026-06-04T07:00:00.000Z",
    id: "indicator:crypto:global:BTC-USD:4H",
    metadata: {},
    movingAverages: {
      ema20: 84_210.2,
      ema50: 83_820.4,
      ema200: 80_155.7,
    },
    oscillators: {
      rsi14: 62.4,
    },
    structure: "uptrend",
    timeframe: "4H",
    levels: {
      resistance: [84_880, 85_520],
      support: [83_200, 82_450],
    },
    volatility: {
      atr14: 1_210.5,
      atrPercent: 1.44,
      baseline: 1.2,
      regime: "expanded",
    },
    volume: {
      average20: 1_180.2,
      current: 1_310.4,
      relativeVolume: 1.11,
      trend: "up",
    },
  },
  generatedAt: "2026-06-04T07:00:00.000Z",
  triggeredBy: "scheduled",
  state: "ACTIONABLE",
  suggestion: "ENTRY_ON_CONFIRMATION",
  summary: "Bullish trend context led by trend alignment and structure.",
  decisionCard: {
    actionPlan: ["Wait for a decisive close above nearby resistance."],
    executionMethod: "Enter after breakout confirmation above resistance.",
    invalidation: "Stand aside if price loses the nearest support.",
    keyReasons: ["Trend alignment remains constructive."],
    riskLevel: "medium",
    summary: "Bullish trend context led by trend alignment and structure.",
  },
  regime: "trend",
  bias: "bullish",
  signalStrengthScore: 82,
  aiConfidence: 79,
  concerns: [],
  suggestedPositionSize: "normal",
  timeframeRelevance:
    "Higher-timeframe swing context for crypto watchlist monitoring.",
  riskFlags: [],
  keyLevels: {
    invalidation: 82_594.75,
    nearestResistance: 84_880,
    nearestSupport: 83_200,
  },
  modelUsed: "gpt-4o-mini",
  promptVersion: "ai-analysis:v1",
  snapshotHash: "signal-hash-btc-4h",
  aiLatencyMs: 420,
  costEstimateUsd: 0.00042,
  metadata: {},
};

const latestSignalFixture: SignalAggregationSnapshot = {
  id: "signal:crypto:global:BTC-USD:4H:2026-06-04T08:00:00.000Z",
  asset: latestAnalysisFixture.asset,
  marketSnapshot: latestAnalysisFixture.marketSnapshot,
  indicatorSnapshot: latestAnalysisFixture.indicatorSnapshot,
  generatedAt: "2026-06-04T08:00:00.000Z",
  signalStrengthScore: 80,
  bias: "bullish",
  regime: "trend",
  timeframeRelevance: latestAnalysisFixture.timeframeRelevance,
  riskFlags: [],
  keyLevels: latestAnalysisFixture.keyLevels,
  labels: [
    {
      details: "Price holds above a fully bullish EMA20/EMA50/EMA200 stack.",
      key: "trend_alignment",
      scoreContribution: 30,
      sentiment: "bullish",
      title: "Trend Alignment",
    },
  ],
  summary: latestAnalysisFixture.summary,
  snapshotHash: "signal-hash-btc-4h-newer",
  metadata: {
    signalAggregationVersion: "signal-aggregation:v1",
  },
};

describe("worker threshold checks", () => {
  it("triggers when current price is within ATR of the nearest level after cooldown", () => {
    const result = evaluateThresholdApproach({
      atr14: 1_210.5,
      currentPrice: 84_140,
      keyLevels: latestAnalysisFixture.keyLevels,
      requestedAt,
      snapshotGeneratedAt: latestAnalysisFixture.generatedAt,
      timeframe: "4H",
    });

    expect(result).toEqual({
      currentPrice: 84_140,
      level: {
        distance: 740,
        kind: "resistance",
        level: 84_880,
      },
      status: "triggered",
      thresholdDistance: 1_210.5,
    });
  });

  it("skips when the latest reference snapshot is still inside the cooldown window", () => {
    const result = evaluateThresholdApproach({
      atr14: 1_210.5,
      currentPrice: 84_140,
      keyLevels: latestAnalysisFixture.keyLevels,
      requestedAt: "2026-06-04T07:20:00.000Z",
      snapshotGeneratedAt: latestAnalysisFixture.generatedAt,
      timeframe: "4H",
    });

    expect(result).toMatchObject({
      currentPrice: 84_140,
      reason: "cooldown_active",
      status: "skipped",
      thresholdDistance: 1_210.5,
    });
  });

  it("uses the freshest available signal or analysis snapshot before triggering", async () => {
    const fetchCurrentPrice = vi.fn(async () => ({
      price: 84_150,
      timestamp: requestedAt,
    }));

    const result = await processThresholdCheckJob({
      apiKey: "cg-demo-key",
      assetId,
      fetchCurrentPrice,
      getLatestAnalysis: vi.fn(async () => latestAnalysisFixture),
      getLatestSignalSnapshot: vi.fn(async () => latestSignalFixture),
      requestedAt,
      timeframe: "4H",
      userId: "test-user",
    });

    expect(fetchCurrentPrice).toHaveBeenCalledOnce();
    expect(result).toEqual({
      assetId,
      currentPrice: 84_150,
      level: {
        distance: 730,
        kind: "resistance",
        level: 84_880,
      },
      referenceSource: "signal",
      status: "triggered",
      thresholdDistance: 1_210.5,
      timeframe: "4H",
    });
  });

  it("skips when there is no stored analysis or signal snapshot to monitor", async () => {
    const result = await processThresholdCheckJob({
      apiKey: "cg-demo-key",
      assetId,
      fetchCurrentPrice: vi.fn(),
      getLatestAnalysis: vi.fn(async () => null),
      getLatestSignalSnapshot: vi.fn(async () => null),
      requestedAt,
      timeframe: "4H",
      userId: "test-user",
    });

    expect(result).toEqual({
      assetId,
      reason: "snapshot_not_found",
      status: "skipped",
      timeframe: "4H",
    });
  });

  it("uses a shorter cooldown for 1H threshold rechecks", () => {
    expect(getThresholdReanalysisCooldownMs("1H")).toBe(15 * 60 * 1000);
    expect(getThresholdReanalysisCooldownMs("4H")).toBe(60 * 60 * 1000);
  });
});
