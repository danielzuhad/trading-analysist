import type {
  AiAnalysisEngineOutput,
  SignalAggregationSnapshot,
} from "@trading-analyst/shared-types";

export function createSignalSnapshotFixture(): SignalAggregationSnapshot {
  return {
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
}

export function createAiOutputFixture(
  overrides: Partial<AiAnalysisEngineOutput> = {},
): AiAnalysisEngineOutput {
  return {
    state: "ACTIONABLE",
    suggestion: "ENTRY_ON_CONFIRMATION",
    summary: "Trend remains constructive, but confirmation is still required.",
    keyReasons: [
      "EMA alignment remains bullish.",
      "RSI confirms upside momentum without obvious exhaustion.",
    ],
    concerns: ["Resistance remains close overhead."],
    actionPlan: [
      "Wait for a decisive close above nearby resistance.",
      "Keep size conservative until follow-through appears.",
    ],
    executionMethod: "Enter after breakout confirmation above resistance.",
    invalidation: "Stand aside if price loses the nearest support.",
    riskLevel: "medium",
    suggestedPositionSize: "conservative",
    aiConfidence: 78,
    ...overrides,
  };
}
