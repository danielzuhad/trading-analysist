import { describe, expect, it } from "vitest";
import {
  alertSchema,
  assetAnalysisSchema,
  assetSchema,
  assetStateTransitionSchema,
  decisionCardSchema,
  executionRecordSchema,
  indicatorSnapshotSchema,
  marketSnapshotSchema,
  positionSchema,
  userPreferenceSchema,
  userWatchlistSchema,
} from "../src/index.js";

const timestamp = "2026-03-31T09:00:00.000Z";

describe("shared contracts", () => {
  it("parses an asset with a non-ambiguous identity", () => {
    const result = assetSchema.parse({
      id: "crypto:binance:SOL-USDT",
      symbol: "SOL",
      displaySymbol: "SOL/USDT",
      name: "Solana",
      assetClass: "crypto",
      market: "global",
      exchange: "binance",
      instrumentType: "spot",
      baseCurrency: "SOL",
      quoteCurrency: "USDT",
      providerSymbol: "SOLUSDT",
      isActive: true,
      metadata: {},
    });

    expect(result.id).toBe("crypto:binance:SOL-USDT");
  });

  it("requires a fully populated decision card contract", () => {
    const invalidCard = decisionCardSchema.safeParse({
      summary: "Momentum improving",
      keyReasons: [],
      actionPlan: ["Wait for confirmation"],
      executionMethod: "Enter above breakout candle",
      invalidation: "Exit below 145",
      riskLevel: "medium",
    });

    expect(invalidCard.success).toBe(false);
  });

  it("uses the camelCase decision card contract expected by the TypeScript domain model", () => {
    const result = decisionCardSchema.safeParse({
      summary: "Momentum improving",
      key_reasons: ["EMA stack bullish"],
      action_plan: ["Wait for confirmation"],
      execution_method: "Enter above breakout candle",
      invalidation: "Exit below 145",
      risk_level: "medium",
    });

    expect(result.success).toBe(false);
  });

  it("parses multi-user watchlist and user preference contracts", () => {
    const watchlist = userWatchlistSchema.parse({
      id: "watchlist-core",
      userId: "user-123",
      name: "Core Swing Book",
      description: "High-conviction mixed assets",
      assetIds: ["crypto:binance:SOL-USDT", "stock:nasdaq:NVDA"],
      priorityAssetIds: ["crypto:binance:SOL-USDT"],
      mutedAssetIds: [],
      tradingStyle: "swing",
      riskProfile: "moderate",
      timeframes: ["1H", "4H"],
      notificationChannels: ["dashboard", "whatsapp"],
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {},
    });

    const preference = userPreferenceSchema.parse({
      id: "pref-123",
      userId: "user-123",
      defaultTradingStyle: "swing",
      defaultRiskProfile: "moderate",
      preferredTimeframes: ["1H", "4H"],
      timezone: "Asia/Jakarta",
      locale: "en-ID",
      notificationChannels: ["dashboard", "whatsapp"],
      alertCooldownMinutes: 15,
      receiveOnlyPositionAlerts: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {},
    });

    expect(watchlist.userId).toBe(preference.userId);
    expect(watchlist.assetIds).toContain("stock:nasdaq:NVDA");
  });

  it("rejects unsupported user-configurable timeframes outside the current MVP scope", () => {
    const watchlist = userWatchlistSchema.safeParse({
      id: "watchlist-fast",
      userId: "user-123",
      name: "Fast Watchlist",
      assetIds: ["crypto:binance:BTC-USDT"],
      tradingStyle: "scalp",
      riskProfile: "aggressive",
      timeframes: ["15M"],
      notificationChannels: ["dashboard"],
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {},
    });

    const preference = userPreferenceSchema.safeParse({
      id: "pref-fast",
      userId: "user-123",
      defaultTradingStyle: "intraday",
      defaultRiskProfile: "aggressive",
      preferredTimeframes: ["1D"],
      timezone: "Asia/Jakarta",
      locale: "en-ID",
      notificationChannels: ["dashboard"],
      alertCooldownMinutes: 15,
      receiveOnlyPositionAlerts: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {},
    });

    expect(watchlist.success).toBe(false);
    expect(preference.success).toBe(false);
  });

  it("parses market and indicator snapshots", () => {
    const marketSnapshot = marketSnapshotSchema.parse({
      id: "market-sol-1h",
      assetId: "crypto:binance:SOL-USDT",
      provider: "binance",
      timeframe: "1H",
      capturedAt: timestamp,
      lastPrice: 148.2,
      bidPrice: 148.1,
      askPrice: 148.3,
      candle: {
        open: 146.4,
        high: 149.1,
        low: 145.9,
        close: 148.2,
        volume: 1823400,
      },
      marketSession: "continuous",
      priceChangePercent: 2.1,
      volumeWeightedAveragePrice: 147.2,
      quoteCurrency: "USDT",
      baseCurrency: "SOL",
      eventFlags: ["reclaimed_resistance"],
      metadata: {},
    });

    const indicatorSnapshot = indicatorSnapshotSchema.parse({
      id: "indicator-sol-1h",
      assetId: "crypto:binance:SOL-USDT",
      timeframe: "1H",
      calculatedAt: timestamp,
      movingAverages: {
        ema20: 146.8,
        ema50: 143.4,
        ema200: 129.2,
      },
      oscillators: {
        rsi14: 61.4,
      },
      volatility: {
        atr14: 3.6,
        atrPercent: 2.4,
        baseline: 2.9,
      },
      volume: {
        current: 1823400,
        average20: 1245000,
        relativeVolume: 1.46,
        trend: "up",
      },
      levels: {
        support: [145.9, 142.2],
        resistance: [149.8, 152.4],
      },
      metadata: {},
    });

    expect(marketSnapshot.assetId).toBe(indicatorSnapshot.assetId);
  });

  it("parses a full active position and its execution record", () => {
    const position = positionSchema.parse({
      id: "position-sol-open",
      userId: "user-123",
      assetId: "crypto:binance:SOL-USDT",
      watchlistId: "watchlist-core",
      sourceAccount: "binance-main",
      direction: "long",
      status: "open",
      quoteCurrency: "USDT",
      entryPrice: 148.2,
      averageEntryPrice: 147.6,
      quantity: 10,
      remainingQuantity: 10,
      notionalValue: 1476,
      realizedPnl: 0,
      unrealizedPnl: 18,
      realizedPnlPercent: 0,
      unrealizedPnlPercent: 1.2,
      stopLoss: 145.9,
      takeProfitLevels: [
        {
          price: 152,
          percentageToClose: 50,
          label: "scale-out-1",
        },
      ],
      thesis: "Trend continuation after reclaim",
      notes: "Recorded from dashboard after Binance fill",
      latestState: "IN_POSITION",
      latestSuggestion: "HOLD",
      openedAt: timestamp,
      lastUpdatedAt: timestamp,
      isBackfilled: false,
      metadata: {},
    });

    const executionRecord = executionRecordSchema.parse({
      id: "execution-sol-buy",
      userId: "user-123",
      assetId: position.assetId,
      positionId: position.id,
      actionType: "BUY",
      source: "dashboard",
      channel: "dashboard",
      sourceAccount: "binance-main",
      executionPrice: 148.2,
      quantity: 10,
      notionalValue: 1482,
      feesPaid: 1.48,
      feeCurrency: "USDT",
      stopLoss: 145.9,
      takeProfitLevels: position.takeProfitLevels,
      note: "Initial entry",
      executedAt: timestamp,
      recordedAt: timestamp,
      isManual: true,
      metadata: {},
    });

    expect(executionRecord.positionId).toBe(position.id);
  });

  it("parses analysis, transition, and alert contracts together", () => {
    const analysis = assetAnalysisSchema.parse({
      id: "analysis-sol-1h",
      userId: "user-123",
      watchlistId: "watchlist-core",
      asset: {
        id: "crypto:binance:SOL-USDT",
        symbol: "SOL",
        displaySymbol: "SOL/USDT",
        name: "Solana",
        assetClass: "crypto",
        market: "global",
        exchange: "binance",
        instrumentType: "spot",
        baseCurrency: "SOL",
        quoteCurrency: "USDT",
        providerSymbol: "SOLUSDT",
        isActive: true,
        metadata: {},
      },
      marketSnapshot: {
        id: "market-sol-1h",
        assetId: "crypto:binance:SOL-USDT",
        provider: "binance",
        timeframe: "1H",
        capturedAt: timestamp,
        lastPrice: 148.2,
        candle: {
          open: 146.4,
          high: 149.1,
          low: 145.9,
          close: 148.2,
          volume: 1823400,
        },
        marketSession: "continuous",
        eventFlags: [],
        metadata: {},
      },
      indicatorSnapshot: {
        id: "indicator-sol-1h",
        assetId: "crypto:binance:SOL-USDT",
        timeframe: "1H",
        calculatedAt: timestamp,
        movingAverages: {
          ema20: 146.8,
          ema50: 143.4,
          ema200: 129.2,
        },
        oscillators: {
          rsi14: 61.4,
        },
        volatility: {
          atr14: 3.6,
        },
        volume: {
          current: 1823400,
          trend: "up",
        },
        levels: {
          support: [145.9],
          resistance: [149.8],
        },
        metadata: {},
      },
      position: {
        id: "position-sol-open",
        userId: "user-123",
        assetId: "crypto:binance:SOL-USDT",
        direction: "long",
        status: "open",
        entryPrice: 148.2,
        averageEntryPrice: 147.6,
        quantity: 10,
        remainingQuantity: 10,
        takeProfitLevels: [],
        openedAt: timestamp,
        lastUpdatedAt: timestamp,
        isBackfilled: false,
        metadata: {},
      },
      state: "IN_POSITION",
      previousState: "ACTIONABLE",
      suggestion: "HOLD",
      decisionCard: {
        summary: "Momentum remains constructive while the position is active.",
        keyReasons: [
          "Price remains above EMA20 and EMA50.",
          "Volume stays above the 20-period baseline.",
        ],
        actionPlan: [
          "Keep the position open while structure holds.",
          "Tighten risk if price loses the reclaim zone.",
        ],
        executionMethod: "Hold and trail risk under 145.9.",
        invalidation: "Exit if price closes below 145.9.",
        riskLevel: "medium",
      },
      regime: "trend",
      bias: "bullish",
      setupQualityScore: 78,
      confidenceScore: 74,
      riskFlags: ["overhead_resistance"],
      keyLevels: {
        entry: 148.2,
        stopLoss: 145.9,
        takeProfitLevels: [152],
      },
      generatedAt: timestamp,
      triggeredBy: "manual_position_update",
      notes: "Converted from watchlist mode after manual entry.",
      metadata: {},
    });

    const transition = assetStateTransitionSchema.parse({
      id: "transition-sol",
      userId: "user-123",
      assetId: analysis.asset.id,
      analysisId: analysis.id,
      positionId: analysis.position?.id,
      fromState: "ACTIONABLE",
      toState: "IN_POSITION",
      changedAt: timestamp,
      triggeredBy: "manual_position_update",
      reason: "User recorded a live position.",
      metadata: {},
    });

    const alert = alertSchema.parse({
      id: "alert-sol",
      userId: "user-123",
      assetId: analysis.asset.id,
      watchlistId: analysis.watchlistId,
      positionId: analysis.position?.id,
      analysisId: analysis.id,
      transitionId: transition.id,
      kind: "position",
      severity: "warning",
      status: "delivered",
      channels: ["dashboard", "whatsapp"],
      title: "SOL position needs attention",
      message:
        "Momentum is intact, but resistance overhead justifies tighter risk.",
      summary: analysis.decisionCard.summary,
      currentState: analysis.state,
      suggestion: analysis.suggestion,
      createdAt: timestamp,
      deliveredAt: timestamp,
      isStale: false,
      metadata: {},
    });

    expect(alert.positionId).toBe(transition.positionId);
    expect(alert.currentState).toBe("IN_POSITION");
  });
});
