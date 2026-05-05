import type {
  AssetState,
  LatestAssetAnalysis,
} from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import { generateStateTransitionAlert } from "./engine.js";

describe("alert engine", () => {
  it("creates a deduplicated market alert when analysis state changes", () => {
    const previousAnalysis = createAnalysis("WATCH");
    const currentAnalysis = createAnalysis("ACTIONABLE", {
      generatedAt: "2026-04-21T12:05:00.000Z",
      snapshotHash: "signal-hash-btc-4h-next",
    });

    const result = generateStateTransitionAlert({
      currentAnalysis,
      previousAnalysis,
      userId: "user-123",
    });

    expect(result).toMatchObject({
      reason: "state_changed",
      status: "created",
    });

    if (result.status !== "created") {
      throw new Error("Expected a state-change alert.");
    }

    expect(result.alert).toMatchObject({
      assetId: "crypto:global:BTC-USD",
      channels: ["dashboard", "whatsapp"],
      currentState: "ACTIONABLE",
      dedupeKey:
        "crypto:global:BTC-USD:4H:WATCH->ACTIONABLE:signal-hash-btc-4h-next",
      kind: "market",
      previousState: "WATCH",
      severity: "critical",
      status: "suggested",
      timeframe: "4H",
      title: "BTC/USD actionable setup",
      userId: "user-123",
    });
  });

  it("skips unchanged states and initial analysis snapshots", () => {
    const currentAnalysis = createAnalysis("WATCH");

    expect(
      generateStateTransitionAlert({
        currentAnalysis,
        previousAnalysis: null,
      }),
    ).toEqual({
      reason: "missing_previous_analysis",
      status: "skipped",
    });
    expect(
      generateStateTransitionAlert({
        currentAnalysis,
        previousAnalysis: createAnalysis("WATCH"),
      }),
    ).toEqual({
      reason: "state_unchanged",
      status: "skipped",
    });
  });

  it("marks position-state alerts as position alerts", () => {
    const result = generateStateTransitionAlert({
      currentAnalysis: createAnalysis("EXIT_WARNING"),
      previousAnalysis: createAnalysis("IN_POSITION"),
    });

    expect(result).toMatchObject({
      status: "created",
    });

    if (result.status !== "created") {
      throw new Error("Expected a position alert.");
    }

    expect(result.alert).toMatchObject({
      currentState: "EXIT_WARNING",
      kind: "position",
      severity: "critical",
    });
  });
});

function createAnalysis(
  state: AssetState,
  overrides: Partial<LatestAssetAnalysis> = {},
): LatestAssetAnalysis {
  const generatedAt = overrides.generatedAt ?? "2026-04-21T08:05:00.000Z";
  const snapshotHash = overrides.snapshotHash ?? "signal-hash-btc-4h";

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
      capturedAt: "2026-04-21T08:00:00.000Z",
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
      id: "indicator:crypto:global:BTC-USD:4H",
      assetId: "crypto:global:BTC-USD",
      timeframe: "4H",
      calculatedAt: "2026-04-21T08:00:00.000Z",
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
    state,
    suggestion: state === "ACTIONABLE" ? "ENTRY_ON_CONFIRMATION" : "WATCH",
    summary: "Trend remains constructive, but confirmation is still required.",
    decisionCard: {
      summary:
        "Trend remains constructive, but confirmation is still required.",
      keyReasons: ["EMA alignment remains bullish."],
      actionPlan: ["Wait for a decisive close above nearby resistance."],
      executionMethod: "Enter after breakout confirmation above resistance.",
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
      "Higher-timeframe swing context for crypto watchlist monitoring.",
    riskFlags: ["Resistance remains close overhead."],
    keyLevels: {
      nearestSupport: 83200,
      nearestResistance: 84880,
      invalidation: 82594.75,
    },
    modelUsed: "gpt-4o-mini",
    promptVersion: "ai-analysis:v1",
    snapshotHash,
    aiLatencyMs: 915,
    costEstimateUsd: 0.0003,
    generatedAt,
    triggeredBy: "manual_recalculation",
    metadata: {
      signalAggregationSnapshotId:
        "signal:crypto:global:BTC-USD:4H:2026-04-21T08:00:00.000Z",
    },
    ...overrides,
  };
}
