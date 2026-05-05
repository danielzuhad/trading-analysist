import type { AiAnalysisProviderResult } from "@trading-analyst/ai-analysis";
import type {
  Alert,
  LatestAssetAnalysis,
  SignalAggregationSnapshot,
} from "@trading-analyst/shared-types";
import { describe, expect, it, vi } from "vitest";
import {
  generateAssetAnalysisFromSignalSnapshot,
  generateLatestAssetAnalysis,
} from "./analysis.js";

const signalSnapshotFixture: SignalAggregationSnapshot = {
  id: "signal:crypto:global:BTC-USD:1H:2026-04-19T08:00:00.000Z",
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
    id: "market:coingecko:crypto:global:BTC-USD:1H",
    assetId: "crypto:global:BTC-USD",
    provider: "coingecko",
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
    id: "indicator:crypto:global:BTC-USD:1H",
    assetId: "crypto:global:BTC-USD",
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
      details: "Price holds above a fully bullish EMA20/EMA50/EMA200 stack.",
    },
  ],
  summary: "Bullish trend context led by trend alignment and structure.",
  snapshotHash: "signal-hash-btc-1h",
  metadata: {
    signalAggregationVersion: "signal-aggregation:v1",
  },
};

describe("worker AI analysis helper", () => {
  it("skips when no signal snapshot exists", async () => {
    const result = await generateLatestAssetAnalysis({
      assetId: "crypto:global:BTC-USD",
      getLatestSignalSnapshot: vi.fn(async () => null),
      timeframe: "1H",
    });

    expect(result).toEqual({
      assetId: "crypto:global:BTC-USD",
      reason: "signal_snapshot_not_found",
      status: "skipped",
      timeframe: "1H",
    });
  });

  it("stores the generated latest AI analysis", async () => {
    const saveAnalysis = vi.fn(
      async (analysis: LatestAssetAnalysis) => analysis,
    );
    const providerResult = {
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
        executionMethod: "Enter after breakout confirmation above resistance.",
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
    } satisfies AiAnalysisProviderResult;

    const result = await generateLatestAssetAnalysis({
      assetId: "crypto:global:BTC-USD",
      getCurrentDailyAiCostUsd: vi.fn(async () => 0),
      getLatestAnalysis: vi.fn(async () => null),
      getLatestSignalSnapshot: vi.fn(async () => signalSnapshotFixture),
      provider: vi.fn(async () => providerResult),
      saveAnalysis,
      timeframe: "1H",
    });

    expect(result).toEqual({
      analysisId: "analysis:latest:crypto:global:BTC-USD:1H",
      assetId: "crypto:global:BTC-USD",
      state: "ACTIONABLE",
      status: "stored",
      timeframe: "1H",
    });
    expect(saveAnalysis).toHaveBeenCalledOnce();
  });

  it("skips when the cost cap is reached for a non-critical previous state", async () => {
    const provider = vi.fn(async () => {
      throw new Error("provider should not run");
    });

    const result = await generateLatestAssetAnalysis({
      assetId: "crypto:global:BTC-USD",
      currentDailyCostUsd: 2.5,
      getLatestAnalysis: vi.fn(
        async () =>
          ({
            id: "analysis:latest:crypto:global:BTC-USD:1H",
            asset: signalSnapshotFixture.asset,
            marketSnapshot: signalSnapshotFixture.marketSnapshot,
            indicatorSnapshot: signalSnapshotFixture.indicatorSnapshot,
            state: "WATCH",
            suggestion: "WATCH",
            summary: "Waiting for stronger confirmation.",
            decisionCard: {
              summary: "Waiting for stronger confirmation.",
              keyReasons: ["Signal quality is not yet decisive."],
              actionPlan: ["Keep monitoring the setup."],
              executionMethod: "No action yet.",
              invalidation: "Stand aside if structure weakens further.",
              riskLevel: "medium",
            },
            regime: signalSnapshotFixture.regime,
            bias: signalSnapshotFixture.bias,
            signalStrengthScore: signalSnapshotFixture.signalStrengthScore,
            aiConfidence: 70,
            concerns: ["Signal quality remains middling."],
            suggestedPositionSize: "none",
            timeframeRelevance: signalSnapshotFixture.timeframeRelevance,
            riskFlags: signalSnapshotFixture.riskFlags,
            keyLevels: signalSnapshotFixture.keyLevels,
            modelUsed: "gpt-4o-mini",
            promptVersion: "ai-analysis:v1",
            snapshotHash: signalSnapshotFixture.snapshotHash,
            aiLatencyMs: 500,
            costEstimateUsd: 0.0001,
            generatedAt: "2026-04-19T08:05:00.000Z",
            triggeredBy: "manual_recalculation",
            metadata: {
              signalAggregationSnapshotId: signalSnapshotFixture.id,
            },
          }) satisfies LatestAssetAnalysis,
      ),
      getLatestSignalSnapshot: vi.fn(async () => signalSnapshotFixture),
      maxDailyAiCostUsd: 2,
      provider,
      timeframe: "1H",
    });

    expect(result).toEqual({
      assetId: "crypto:global:BTC-USD",
      reason: "daily_cost_cap_reached",
      status: "skipped",
      timeframe: "1H",
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("stores analysis directly from an in-memory signal snapshot", async () => {
    const saveAnalysis = vi.fn(
      async (analysis: LatestAssetAnalysis) => analysis,
    );
    const providerResult = {
      aiLatencyMs: 120,
      modelUsed: "gpt-4o-mini",
      output: {
        state: "WATCH",
        suggestion: "WATCH",
        summary: "Context is mixed but still constructive enough to monitor.",
        keyReasons: ["Macro context is incomplete but not outright bearish."],
        concerns: ["News provider is unavailable."],
        actionPlan: ["Keep watching the higher-timeframe structure."],
        executionMethod: "No entry yet.",
        invalidation: "Stand aside if support fails.",
        riskLevel: "medium",
        suggestedPositionSize: "none",
        aiConfidence: 80,
      },
      usage: {
        cachedInputTokens: 0,
        inputTokens: 100,
        outputTokens: 50,
      },
    } satisfies AiAnalysisProviderResult;

    const result = await generateAssetAnalysisFromSignalSnapshot({
      getCurrentDailyAiCostUsd: vi.fn(async () => 0),
      getLatestAnalysis: vi.fn(async () => null),
      provider: vi.fn(async () => providerResult),
      saveAnalysis,
      signalSnapshot: {
        ...signalSnapshotFixture,
        marketContext: {
          id: "context:crypto:global:BTC-USD:1H:2026-04-19T08:00:00.000Z",
          assetId: "crypto:global:BTC-USD",
          timeframe: "1H",
          generatedAt: "2026-04-19T08:00:00.000Z",
          isPartial: true,
          missingProviders: ["bybit"],
          providers: [
            {
              provider: "fear-and-greed",
              status: "active",
              checkedAt: "2026-04-19T08:00:00.000Z",
              metadata: {},
            },
            {
              provider: "bybit",
              status: "down",
              checkedAt: "2026-04-19T08:00:00.000Z",
              detail: "Provider timeout",
              metadata: {},
            },
          ],
          sentiment: {
            classification: "Fear",
            value: 32,
          },
          metadata: {},
        },
      },
      timeframe: "1H",
    });

    expect(result).toEqual({
      analysisId: "analysis:latest:crypto:global:BTC-USD:1H",
      assetId: "crypto:global:BTC-USD",
      state: "WATCH",
      status: "stored",
      timeframe: "1H",
    });
    expect(saveAnalysis).toHaveBeenCalledOnce();
    expect(saveAnalysis.mock.calls[0]?.[0].metadata).toMatchObject({
      marketContext: {
        isPartial: true,
        missingProviders: ["bybit"],
      },
    });
  });

  it("generates an alert when the latest analysis changes state", async () => {
    const saveAnalysis = vi.fn(
      async (analysis: LatestAssetAnalysis) => analysis,
    );
    const saveGeneratedAlert = vi.fn(async (alert: Alert) => ({
      alert,
      status: "created" as const,
    }));
    const providerResult = {
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
        executionMethod: "Enter after breakout confirmation above resistance.",
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
    } satisfies AiAnalysisProviderResult;

    const result = await generateAssetAnalysisFromSignalSnapshot({
      getCurrentDailyAiCostUsd: vi.fn(async () => 0),
      getLatestAnalysis: vi.fn(async () => createAnalysisFixture("WATCH")),
      provider: vi.fn(async () => providerResult),
      saveAnalysis,
      saveGeneratedAlert,
      signalSnapshot: signalSnapshotFixture,
      timeframe: "1H",
    });

    expect(result).toEqual({
      analysisId: "analysis:latest:crypto:global:BTC-USD:1H",
      assetId: "crypto:global:BTC-USD",
      state: "ACTIONABLE",
      status: "stored",
      timeframe: "1H",
    });
    expect(saveGeneratedAlert).toHaveBeenCalledOnce();
    expect(saveGeneratedAlert.mock.calls[0]?.[0]).toMatchObject({
      assetId: "crypto:global:BTC-USD",
      channels: ["dashboard", "whatsapp"],
      currentState: "ACTIONABLE",
      previousState: "WATCH",
      severity: "critical",
      status: "suggested",
      timeframe: "1H",
    });
  });

  it("delivers a newly created alert through Twilio WhatsApp when configured", async () => {
    const saveAnalysis = vi.fn(
      async (analysis: LatestAssetAnalysis) => analysis,
    );
    const saveGeneratedAlert = vi.fn(async (alert: Alert) => ({
      alert,
      status: "created" as const,
    }));
    const markDeliveredAlert = vi.fn(async () => null);
    const sendWhatsappMessage = vi.fn(async () => ({
      from: "whatsapp:+14155238886",
      sid: "SM123",
      status: "queued",
      to: "whatsapp:+628123456789",
    }));
    const providerResult = {
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
        executionMethod: "Enter after breakout confirmation above resistance.",
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
    } satisfies AiAnalysisProviderResult;

    await generateAssetAnalysisFromSignalSnapshot({
      getCurrentDailyAiCostUsd: vi.fn(async () => 0),
      getLatestAnalysis: vi.fn(async () => createAnalysisFixture("WATCH")),
      markDeliveredAlert:
        markDeliveredAlert as typeof import("@trading-analyst/db").markAlertDelivered,
      provider: vi.fn(async () => providerResult),
      saveAnalysis,
      saveGeneratedAlert,
      sendWhatsappMessage,
      signalSnapshot: signalSnapshotFixture,
      timeframe: "1H",
      whatsappAlertDelivery: {
        accountSid: "AC123",
        authToken: "auth",
        from: "+14155238886",
        to: "+628123456789",
      },
    });

    expect(sendWhatsappMessage).toHaveBeenCalledOnce();
    const firstWhatsappCall = (sendWhatsappMessage.mock.calls[0] ??
      []) as unknown as [
      {
        accountSid: string;
        body: string;
        from: string;
        to: string;
      },
    ];

    expect(firstWhatsappCall[0]).toMatchObject({
      accountSid: "AC123",
      body: expect.stringContaining("BTC/USD actionable setup"),
      from: "+14155238886",
      to: "+628123456789",
    });
    expect(markDeliveredAlert).toHaveBeenCalledOnce();
    const firstDeliveryCall = (markDeliveredAlert.mock.calls[0] ??
      []) as unknown as [string, Record<string, unknown>];

    expect(firstDeliveryCall[0]).toBe(
      "alert:crypto:global:BTC-USD:1H:WATCH->ACTIONABLE:signal-hash-btc-1h",
    );
    expect(firstDeliveryCall[1]).toMatchObject({
      metadata: {
        chatLayerChannel: "whatsapp",
        chatLayerMessageSid: "SM123",
        chatLayerProvider: "twilio",
        chatLayerRecipient: "whatsapp:+628123456789",
        chatLayerStatus: "queued",
      },
    });
  });
});

function createAnalysisFixture(state: LatestAssetAnalysis["state"]) {
  return {
    id: "analysis:latest:crypto:global:BTC-USD:1H",
    asset: signalSnapshotFixture.asset,
    marketSnapshot: signalSnapshotFixture.marketSnapshot,
    indicatorSnapshot: signalSnapshotFixture.indicatorSnapshot,
    state,
    suggestion: state === "ACTIONABLE" ? "ENTRY_ON_CONFIRMATION" : "WATCH",
    summary: "Waiting for stronger confirmation.",
    decisionCard: {
      summary: "Waiting for stronger confirmation.",
      keyReasons: ["Signal quality is not yet decisive."],
      actionPlan: ["Keep monitoring the setup."],
      executionMethod: "No action yet.",
      invalidation: "Stand aside if structure weakens further.",
      riskLevel: "medium",
    },
    regime: signalSnapshotFixture.regime,
    bias: signalSnapshotFixture.bias,
    signalStrengthScore: signalSnapshotFixture.signalStrengthScore,
    aiConfidence: 70,
    concerns: ["Signal quality remains middling."],
    suggestedPositionSize: "none",
    timeframeRelevance: signalSnapshotFixture.timeframeRelevance,
    riskFlags: signalSnapshotFixture.riskFlags,
    keyLevels: signalSnapshotFixture.keyLevels,
    modelUsed: "gpt-4o-mini",
    promptVersion: "ai-analysis:v1",
    snapshotHash: signalSnapshotFixture.snapshotHash,
    aiLatencyMs: 500,
    costEstimateUsd: 0.0001,
    generatedAt: "2026-04-19T08:05:00.000Z",
    triggeredBy: "manual_recalculation",
    metadata: {
      signalAggregationSnapshotId: signalSnapshotFixture.id,
    },
  } satisfies LatestAssetAnalysis;
}
