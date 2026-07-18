import type {
  AnalysisOutcome,
  LatestAssetAnalysis,
  MarketCandle,
} from "@trading-analyst/shared-types";
import { describe, expect, it, vi } from "vitest";
import {
  buildPendingAnalysisOutcome,
  evaluateOutcomeAgainstMarket,
  processOutcomeEvaluationJob,
} from "./outcomes.js";

function createAnalysisFixture(): LatestAssetAnalysis {
  return {
    id: "analysis:latest:crypto:global:BTC-USD:4H",
    asset: {
      id: "crypto:global:BTC-USD",
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
      id: "market:coingecko:crypto:global:BTC-USD:4H",
      assetId: "crypto:global:BTC-USD",
      provider: "coingecko",
      timeframe: "4H",
      capturedAt: "2026-07-01T08:00:00.000Z",
      lastPrice: 84000,
      candle: {
        open: 83800,
        high: 84200,
        low: 83600,
        close: 84000,
        volume: 1200,
      },
      marketSession: "continuous",
      eventFlags: [],
      metadata: {},
    },
    indicatorSnapshot: {
      id: "indicator:crypto:global:BTC-USD:4H",
      assetId: "crypto:global:BTC-USD",
      timeframe: "4H",
      calculatedAt: "2026-07-01T08:00:00.000Z",
      movingAverages: {
        ema20: 83800,
        ema50: 83000,
        ema200: 80000,
      },
      oscillators: {
        rsi14: 60,
      },
      volatility: {
        atr14: 1200,
        atrPercent: 1.4,
        baseline: 1.2,
        regime: "expanded",
      },
      volume: {
        current: 1200,
        average20: 1100,
        relativeVolume: 1.1,
        trend: "up",
      },
      levels: {
        support: [83000],
        resistance: [85000],
      },
      structure: "uptrend",
      metadata: {},
    },
    state: "ACTIONABLE",
    suggestion: "ENTRY_ON_CONFIRMATION",
    summary: "Uptrend intact.",
    decisionCard: {
      summary: "Uptrend intact.",
      keyReasons: ["EMA stack bullish."],
      actionPlan: ["Wait for breakout."],
      executionMethod: "Enter after confirmation.",
      invalidation: "Below nearest support.",
      riskLevel: "medium",
    },
    regime: "trend",
    bias: "bullish",
    signalStrengthScore: 82,
    aiConfidence: 78,
    concerns: [],
    suggestedPositionSize: "conservative",
    timeframeRelevance: "Primary operational timeframe.",
    riskFlags: [],
    keyLevels: {
      nearestSupport: 83000,
      nearestResistance: 85000,
      invalidation: 82500,
    },
    modelUsed: "gpt-4o-mini",
    promptVersion: "ai-analysis:v1",
    snapshotHash: "hash-btc-4h",
    aiLatencyMs: 900,
    costEstimateUsd: 0.0003,
    generatedAt: "2026-07-01T08:00:00.000Z",
    triggeredBy: "scheduled",
    metadata: {},
  };
}

function createCandle(
  timestamp: string,
  overrides: Partial<MarketCandle> = {},
): MarketCandle {
  return {
    timestamp,
    open: 84000,
    high: 84500,
    low: 83500,
    close: 84200,
    volume: 1000,
    ...overrides,
  };
}

describe("buildPendingAnalysisOutcome", () => {
  it("captures the prediction and schedules evaluation after the horizon", () => {
    const outcome = buildPendingAnalysisOutcome({
      analysis: createAnalysisFixture(),
    });

    expect(outcome).toMatchObject({
      id: "outcome:crypto:global:BTC-USD:4H:hash-btc-4h:2026-07-01T08:00:00.000Z",
      analysisId: "analysis:latest:crypto:global:BTC-USD:4H",
      assetId: "crypto:global:BTC-USD",
      timeframe: "4H",
      state: "ACTIONABLE",
      bias: "bullish",
      modelUsed: "gpt-4o-mini",
      priceAtAnalysis: 84000,
      status: "pending",
    });
    expect(outcome.evaluateAfter).toBe("2026-07-02T08:00:00.000Z");
  });

  it("honors a custom horizon", () => {
    const outcome = buildPendingAnalysisOutcome({
      analysis: createAnalysisFixture(),
      horizonHours: 48,
    });

    expect(outcome.evaluateAfter).toBe("2026-07-03T08:00:00.000Z");
  });
});

describe("evaluateOutcomeAgainstMarket", () => {
  const outcome = buildPendingAnalysisOutcome({
    analysis: createAnalysisFixture(),
  });

  it("marks a bullish call correct when price rises without hitting invalidation", () => {
    const evaluation = evaluateOutcomeAgainstMarket({
      candles: [
        createCandle("2026-07-01T12:00:00.000Z"),
        createCandle("2026-07-01T16:00:00.000Z", { low: 83400 }),
      ],
      evaluatedAt: "2026-07-02T08:00:00.000Z",
      outcome,
      priceAtEvaluation: 86000,
    });

    expect(evaluation.directionCorrect).toBe(true);
    expect(evaluation.invalidationHit).toBe(false);
    expect(evaluation.priceChangePercent).toBeCloseTo(2.381, 3);
    expect(evaluation.candlesCovered).toBe(2);
  });

  it("detects an invalidation hit from intraperiod candle lows", () => {
    const evaluation = evaluateOutcomeAgainstMarket({
      candles: [createCandle("2026-07-01T16:00:00.000Z", { low: 82400 })],
      evaluatedAt: "2026-07-02T08:00:00.000Z",
      outcome,
      priceAtEvaluation: 83500,
    });

    expect(evaluation.directionCorrect).toBe(false);
    expect(evaluation.invalidationHit).toBe(true);
  });

  it("falls back to the evaluation price when no candles cover the window", () => {
    const evaluation = evaluateOutcomeAgainstMarket({
      candles: [createCandle("2026-06-30T08:00:00.000Z", { low: 80000 })],
      evaluatedAt: "2026-07-02T08:00:00.000Z",
      outcome,
      priceAtEvaluation: 82000,
    });

    expect(evaluation.candlesCovered).toBe(0);
    expect(evaluation.invalidationHit).toBe(true);
    expect(evaluation.directionCorrect).toBe(false);
  });

  it("returns null direction for a neutral bias", () => {
    const neutralOutcome: AnalysisOutcome = {
      ...outcome,
      bias: "neutral",
    };
    const evaluation = evaluateOutcomeAgainstMarket({
      candles: [],
      evaluatedAt: "2026-07-02T08:00:00.000Z",
      outcome: neutralOutcome,
      priceAtEvaluation: 85000,
    });

    expect(evaluation.directionCorrect).toBeNull();
  });
});

describe("processOutcomeEvaluationJob", () => {
  it("evaluates due outcomes against the latest market data", async () => {
    const outcome = buildPendingAnalysisOutcome({
      analysis: createAnalysisFixture(),
    });
    const completeOutcome = vi.fn(async () => undefined);
    const listDueOutcomes = vi.fn(async () => [outcome]);
    const getMarketData = vi.fn(async () => ({
      series: {
        assetId: "crypto:global:BTC-USD",
        provider: "coingecko",
        timeframe: "4H" as const,
        capturedAt: "2026-07-02T08:00:00.000Z",
        lastPrice: 86000,
        candles: [createCandle("2026-07-01T12:00:00.000Z")],
        marketSession: "continuous" as const,
        eventFlags: [],
        metadata: {},
      },
      snapshot: {
        id: "market:coingecko:crypto:global:BTC-USD:4H",
        assetId: "crypto:global:BTC-USD",
        provider: "coingecko",
        timeframe: "4H" as const,
        capturedAt: "2026-07-02T08:00:00.000Z",
        lastPrice: 86000,
        candle: createCandle("2026-07-02T08:00:00.000Z"),
        marketSession: "continuous" as const,
        eventFlags: [],
        metadata: {},
      },
    }));

    const result = await processOutcomeEvaluationJob({
      assetId: "crypto:global:BTC-USD",
      completeOutcome,
      getMarketData,
      listDueOutcomes,
      logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
      requestedAt: "2026-07-02T08:00:00.000Z",
      timeframe: "4H",
    });

    expect(result).toMatchObject({
      evaluated: 1,
      skipped: 0,
      status: "completed",
    });
    expect(completeOutcome).toHaveBeenCalledWith(
      outcome.id,
      expect.objectContaining({
        directionCorrect: true,
        priceAtEvaluation: 86000,
      }),
      undefined,
    );
  });

  it("skips evaluation when market data is missing", async () => {
    const outcome = buildPendingAnalysisOutcome({
      analysis: createAnalysisFixture(),
    });
    const result = await processOutcomeEvaluationJob({
      assetId: "crypto:global:BTC-USD",
      completeOutcome: vi.fn(async () => undefined),
      getMarketData: vi.fn(async () => null),
      listDueOutcomes: vi.fn(async () => [outcome]),
      logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
      requestedAt: "2026-07-02T08:00:00.000Z",
      timeframe: "4H",
    });

    expect(result).toMatchObject({
      evaluated: 0,
      skipped: 1,
      status: "skipped_no_market_data",
    });
  });

  it("completes immediately when nothing is due", async () => {
    const listDueOutcomes = vi.fn(async () => []);
    const getMarketData = vi.fn(async () => null);

    const result = await processOutcomeEvaluationJob({
      assetId: "crypto:global:BTC-USD",
      completeOutcome: vi.fn(async () => undefined),
      getMarketData,
      listDueOutcomes,
      logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
      requestedAt: "2026-07-02T08:00:00.000Z",
      timeframe: "4H",
    });

    expect(result.status).toBe("completed");
    expect(getMarketData).not.toHaveBeenCalled();
  });
});
