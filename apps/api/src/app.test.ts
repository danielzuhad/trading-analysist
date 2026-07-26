import { buildTwilioWebhookSignature } from "@trading-analyst/chat-layer";
import {
  closePosition,
  createPosition,
  getActivePositionForAsset,
  getAnalysisQualitySummary,
  getLatestAssetAnalysis,
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  getLatestSignalAggregationSnapshot,
  listAlerts,
  listPositions,
  listServiceHeartbeats,
  pingDatabase,
  updatePosition,
} from "@trading-analyst/db";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

vi.mock("@trading-analyst/db", () => ({
  addWatchlistAsset: vi.fn(async () => ({ status: "created" })),
  closePosition: vi.fn(async () => null),
  closeDatabase: vi.fn(async () => undefined),
  createApiToken: vi.fn(async () => ({ token: "token", tokenId: "token-1" })),
  createPosition: vi.fn(),
  createUser: vi.fn(async () => null),
  ensureDefaultWatchlistAssets: vi.fn(async () => undefined),
  getWatchlistAsset: vi.fn(async () => null),
  getWatchlistAssetBySymbol: vi.fn(async () => null),
  listUsers: vi.fn(async () => []),
  listWatchlistAssets: vi.fn(async () => []),
  removeWatchlistAsset: vi.fn(async () => ({ status: "not_found" })),
  resolveApiToken: vi.fn(async () => null),
  getActivePositionForAsset: vi.fn(async () => null),
  getAnalysisQualitySummary: vi.fn(async () => ({
    buckets: [],
    evaluatedCount: 0,
    pendingCount: 0,
  })),
  getLatestAssetAnalysis: vi.fn(async () => null),
  getLatestIndicatorSnapshot: vi.fn(async () => null),
  getLatestMarketData: vi.fn(async () => null),
  getLatestSignalAggregationSnapshot: vi.fn(async () => null),
  listAlerts: vi.fn(async () => []),
  listPositions: vi.fn(async () => []),
  listServiceHeartbeats: vi.fn(async () => []),
  pingDatabase: vi.fn(async () => undefined),
  updatePosition: vi.fn(async () => null),
  verifyUserPassword: vi.fn(async () => null),
}));

const pingRedisMock = vi.fn(async () => "PONG");

vi.mock("ioredis", () => ({
  Redis: class {
    ping() {
      return pingRedisMock();
    }

    quit() {
      return Promise.resolve();
    }
  },
}));

const app = await buildApp({
  NODE_ENV: "test",
  API_HOST: "api.invalid",
  API_PORT: 3001,
  COINGECKO_API_PLAN: "demo",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
  REDIS_URL: "redis://127.0.0.1:6379",
});
const twilioAuthToken = "twilio-auth-token";
const twilioWebhookUrl = "http://api.invalid/chat-layer/twilio/webhook";
const twilioChatUserId = "chat-user-twilio";
const twilioApp = await buildApp({
  NODE_ENV: "test",
  API_HOST: "api.invalid",
  API_PORT: 3001,
  CHAT_LAYER_USER_ID: twilioChatUserId,
  COINGECKO_API_PLAN: "demo",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
  REDIS_URL: "redis://127.0.0.1:6379",
  TWILIO_AUTH_TOKEN: twilioAuthToken,
  TWILIO_WEBHOOK_URL: twilioWebhookUrl,
});
const telegramWebhookSecret = "telegram-webhook-secret-0123456789";
const telegramApp = await buildApp({
  NODE_ENV: "test",
  API_HOST: "api.invalid",
  API_PORT: 3001,
  COINGECKO_API_PLAN: "demo",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
  REDIS_URL: "redis://127.0.0.1:6379",
  TELEGRAM_BOT_TOKEN: "telegram-bot-token",
  TELEGRAM_CHAT_ID: "8786340516",
  TELEGRAM_WEBHOOK_SECRET: telegramWebhookSecret,
});

afterEach(() => {
  vi.mocked(closePosition).mockReset();
  vi.mocked(closePosition).mockResolvedValue(null);
  vi.mocked(createPosition).mockReset();
  vi.mocked(createPosition).mockImplementation(async (input) =>
    createPositionSnapshot(input.assetId, input.direction),
  );
  vi.mocked(getActivePositionForAsset).mockReset();
  vi.mocked(getActivePositionForAsset).mockResolvedValue(null);
  vi.mocked(getLatestAssetAnalysis).mockReset();
  vi.mocked(getLatestAssetAnalysis).mockResolvedValue(null);
  vi.mocked(getLatestIndicatorSnapshot).mockReset();
  vi.mocked(getLatestIndicatorSnapshot).mockResolvedValue(null);
  vi.mocked(getLatestMarketData).mockReset();
  vi.mocked(getLatestMarketData).mockResolvedValue(null);
  vi.mocked(getLatestSignalAggregationSnapshot).mockReset();
  vi.mocked(getLatestSignalAggregationSnapshot).mockResolvedValue(null);
  vi.mocked(listAlerts).mockReset();
  vi.mocked(listAlerts).mockResolvedValue([]);
  vi.mocked(listPositions).mockReset();
  vi.mocked(listPositions).mockResolvedValue([]);
  vi.mocked(listServiceHeartbeats).mockReset();
  vi.mocked(listServiceHeartbeats).mockResolvedValue([]);
  vi.mocked(pingDatabase).mockReset();
  vi.mocked(pingDatabase).mockResolvedValue(undefined);
  vi.mocked(updatePosition).mockReset();
  vi.mocked(updatePosition).mockResolvedValue(null);
  pingRedisMock.mockReset();
  pingRedisMock.mockResolvedValue("PONG");
});

function createAsset(assetId: string, symbol: string, name: string) {
  return {
    id: assetId,
    symbol,
    displaySymbol: `${symbol}/USD`,
    name,
    assetClass: "crypto" as const,
    market: "global",
    exchange: "global",
    instrumentType: "spot",
    baseCurrency: symbol,
    quoteCurrency: "USD",
    providerSymbol: `${symbol}/USD`,
    isActive: true,
    metadata: {},
  };
}

function createMarketData(
  asset: ReturnType<typeof createAsset>,
  timeframe: "1H" | "4H",
) {
  return {
    series: {
      assetId: asset.id,
      provider: "coingecko",
      timeframe,
      capturedAt: "2026-04-20T08:00:00.000Z",
      lastPrice: 84250.5,
      candles: [
        {
          timestamp: "2026-04-20T08:00:00.000Z",
          open: 84180.7,
          high: 84420.2,
          low: 84090.4,
          close: 84250.5,
          volume: 1310.4,
        },
      ],
      marketSession: "continuous" as const,
      priceChangePercent: 2.1,
      eventFlags: [],
      metadata: {},
    },
    snapshot: {
      id: `market:coingecko:${asset.id}:${timeframe}`,
      assetId: asset.id,
      provider: "coingecko",
      timeframe,
      capturedAt: "2026-04-20T08:00:00.000Z",
      lastPrice: 84250.5,
      candle: {
        open: 84180.7,
        high: 84420.2,
        low: 84090.4,
        close: 84250.5,
        volume: 1310.4,
      },
      marketSession: "continuous" as const,
      priceChangePercent: 2.1,
      eventFlags: [],
      metadata: {},
    },
  };
}

function createIndicatorSnapshot(
  asset: ReturnType<typeof createAsset>,
  timeframe: "1H" | "4H",
) {
  return {
    id: `indicator:${asset.id}:${timeframe}`,
    assetId: asset.id,
    timeframe,
    calculatedAt: "2026-04-20T08:00:00.000Z",
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
      regime: "expanded" as const,
    },
    volume: {
      current: 1310.4,
      average20: 1180.2,
      relativeVolume: 1.11,
      trend: "up" as const,
    },
    levels: {
      support: [83200, 82450],
      resistance: [84880, 85520],
    },
    structure: "uptrend" as const,
    metadata: {},
  };
}

function createSignalSnapshot(
  asset: ReturnType<typeof createAsset>,
  timeframe: "1H" | "4H",
) {
  return {
    id: `signal:${asset.id}:${timeframe}:2026-04-20T08:00:00.000Z`,
    asset,
    marketSnapshot: createMarketData(asset, timeframe).snapshot,
    indicatorSnapshot: createIndicatorSnapshot(asset, timeframe),
    generatedAt: "2026-04-20T08:00:00.000Z",
    signalStrengthScore: 82,
    bias: "bullish" as const,
    regime: "trend" as const,
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
        sentiment: "bullish" as const,
        scoreContribution: 30,
        details: "Price holds above a fully bullish EMA20/EMA50/EMA200 stack.",
      },
    ],
    summary: "Bullish trend context led by trend alignment and structure.",
    snapshotHash: `signal-hash-${asset.symbol.toLowerCase()}-${timeframe.toLowerCase()}`,
    metadata: {
      signalAggregationVersion: "signal-aggregation:v1",
    },
  };
}

function createAnalysisSnapshot(
  asset: ReturnType<typeof createAsset>,
  timeframe: "1H" | "4H",
) {
  return {
    id: `analysis:latest:${asset.id}:${timeframe}`,
    asset,
    marketSnapshot: createMarketData(asset, timeframe).snapshot,
    indicatorSnapshot: createIndicatorSnapshot(asset, timeframe),
    state: "ACTIONABLE" as const,
    suggestion: "ENTRY_ON_CONFIRMATION" as const,
    summary: "Trend remains constructive, but confirmation is still required.",
    decisionCard: {
      summary:
        "Trend remains constructive, but confirmation is still required.",
      keyReasons: ["EMA alignment remains bullish."],
      actionPlan: ["Wait for a decisive close above nearby resistance."],
      executionMethod: "Enter after breakout confirmation above resistance.",
      invalidation: "Stand aside if price loses the nearest support.",
      riskLevel: "medium" as const,
    },
    regime: "trend" as const,
    bias: "bullish" as const,
    signalStrengthScore: 82,
    aiConfidence: 78,
    concerns: ["Resistance remains close overhead."],
    suggestedPositionSize: "conservative" as const,
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
    snapshotHash: `signal-hash-${asset.symbol.toLowerCase()}-${timeframe.toLowerCase()}`,
    aiLatencyMs: 915,
    costEstimateUsd: 0.0003,
    generatedAt: "2026-04-20T08:05:00.000Z",
    triggeredBy: "manual_recalculation" as const,
    metadata: {
      signalAggregationSnapshotId: `signal:${asset.id}:${timeframe}:2026-04-20T08:00:00.000Z`,
    },
  };
}

function createPositionSnapshot(
  assetId = "crypto:global:BTC-USD",
  direction: "long" | "short" = "long",
) {
  return {
    id: "position-btc-open",
    userId: "system:default",
    assetId,
    direction,
    status: "open" as const,
    quoteCurrency: "USD",
    entryPrice: 84250.5,
    averageEntryPrice: 84250.5,
    quantity: 0.25,
    remainingQuantity: 0.25,
    notionalValue: 21062.625,
    stopLoss: 82450,
    takeProfitLevels: [
      {
        percentageToClose: 50,
        price: 86800,
      },
    ],
    thesis: "Breakout continuation after 4H confirmation.",
    openedAt: "2026-04-21T08:00:00.000Z",
    lastUpdatedAt: "2026-04-21T08:00:00.000Z",
    isBackfilled: false,
    metadata: {},
  };
}

describe("api health routes", () => {
  it("returns a basic health payload", async () => {
    vi.mocked(listServiceHeartbeats).mockResolvedValueOnce([
      {
        checkedAt: "2026-04-20T08:00:00.000Z",
        payload: {
          maxDailyAiCostUsd: 2,
        },
        serviceName: "ai:daily-cost-cap",
        status: "ok",
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "api",
      status: "ok",
      environment: "test",
      operational: {
        ai: {
          currentState: "ok",
          maxDailyAiCostUsd: 2,
        },
      },
    });
  });

  it("adds CORS headers for browser-based readiness checks", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/readyz",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers.vary).toBe("Origin");
  });

  it("returns detailed readiness issues when Redis is unavailable", async () => {
    vi.mocked(pingDatabase).mockResolvedValueOnce(undefined);
    vi.mocked(listServiceHeartbeats).mockResolvedValueOnce([
      {
        checkedAt: "2026-04-20T08:00:00.000Z",
        payload: {
          detail: "Provider timeout",
          latencyMs: 950,
        },
        serviceName: "provider:bybit",
        status: "down",
      },
      {
        checkedAt: "2026-04-20T08:00:00.000Z",
        payload: {
          maxDailyAiCostUsd: 2,
        },
        serviceName: "ai:daily-cost-cap",
        status: "degraded",
      },
    ]);
    pingRedisMock.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:6379"), {
        code: "ECONNREFUSED",
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/readyz",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      service: "api",
      status: "degraded",
      checks: {
        database: {
          ok: true,
          target: "127.0.0.1:5432",
        },
        redis: {
          hint: "Start Redis or Docker Compose, then retry the worker and API.",
          ok: false,
          target: "127.0.0.1:6379",
        },
      },
      operational: {
        ai: {
          currentState: "cap-reached",
          maxDailyAiCostUsd: 2,
        },
        providers: {
          bybit: {
            detail: "Provider timeout",
            latencyMs: 950,
            status: "down",
          },
        },
      },
    });
    expect(response.json().issues).toContain(
      "Redis is not reachable at 127.0.0.1:6379. The worker will keep logging connection errors until Redis is available.",
    );
  });

  it("surfaces OpenAI quota failures through operational health", async () => {
    vi.mocked(listServiceHeartbeats).mockResolvedValueOnce([
      {
        checkedAt: "2026-06-08T07:00:00.000Z",
        payload: {
          currentState: "quota-exceeded",
          detail:
            "OpenAI API credits are exhausted or billing is inactive. Add credits, verify billing, then rerun the worker.",
          maxDailyAiCostUsd: 2,
          statusCode: 429,
        },
        serviceName: "ai:daily-cost-cap",
        status: "down",
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      operational: {
        ai: {
          checkedAt: "2026-06-08T07:00:00.000Z",
          currentState: "quota-exceeded",
          detail:
            "OpenAI API credits are exhausted or billing is inactive. Add credits, verify billing, then rerun the worker.",
          maxDailyAiCostUsd: 2,
        },
      },
    });
  });

  it("returns the latest market snapshot when it exists", async () => {
    vi.mocked(getLatestMarketData).mockResolvedValueOnce({
      series: {
        assetId: "crypto:global:BTC-USD",
        provider: "coingecko",
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
        id: "market:coingecko:crypto:global:BTC-USD:1H",
        assetId: "crypto:global:BTC-USD",
        provider: "coingecko",
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
    });

    const response = await app.inject({
      method: "GET",
      url: "/market-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=1H",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        assetId: "crypto:global:BTC-USD",
        provider: "coingecko",
        timeframe: "1H",
      },
    });
  });

  it("returns 404 when the requested market snapshot is missing", async () => {
    vi.mocked(getLatestMarketData).mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "GET",
      url: "/market-snapshots/latest?assetId=crypto:global:ETH-USD&timeframe=4H",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: "MARKET_SNAPSHOT_NOT_FOUND",
      assetId: "crypto:global:ETH-USD",
      timeframe: "4H",
    });
  });

  it("returns the latest indicator snapshot when it exists", async () => {
    vi.mocked(getLatestIndicatorSnapshot).mockResolvedValueOnce({
      id: "indicator:crypto:global:BTC-USD:1H",
      assetId: "crypto:global:BTC-USD",
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
    });

    const response = await app.inject({
      method: "GET",
      url: "/indicator-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=1H",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        assetId: "crypto:global:BTC-USD",
        structure: "uptrend",
        timeframe: "1H",
      },
    });
  });

  it("returns the latest signal snapshot when it exists", async () => {
    vi.mocked(getLatestSignalAggregationSnapshot).mockResolvedValueOnce({
      id: "signal:crypto:global:BTC-USD:1H:2026-04-04T04:00:00.000Z",
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
        id: "indicator:crypto:global:BTC-USD:1H",
        assetId: "crypto:global:BTC-USD",
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
    });

    const response = await app.inject({
      method: "GET",
      url: "/signal-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=1H",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        asset: {
          id: "crypto:global:BTC-USD",
        },
        bias: "bullish",
        signalStrengthScore: 82,
      },
    });
  });

  it("returns the latest asset analysis when it exists", async () => {
    vi.mocked(getLatestAssetAnalysis).mockResolvedValueOnce({
      id: "analysis:latest:crypto:global:BTC-USD:1H",
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
      state: "ACTIONABLE",
      suggestion: "ENTRY_ON_CONFIRMATION",
      summary:
        "Trend remains constructive, but confirmation is still required.",
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
        signalAggregationSnapshotId:
          "signal:crypto:global:BTC-USD:1H:2026-04-19T08:00:00.000Z",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/asset-analyses/latest?assetId=crypto:global:BTC-USD&timeframe=1H",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        aiConfidence: 78,
        state: "ACTIONABLE",
        summary:
          "Trend remains constructive, but confirmation is still required.",
      },
    });
  });

  it("returns the analysis quality summary with filters", async () => {
    vi.mocked(getAnalysisQualitySummary).mockResolvedValueOnce({
      buckets: [
        {
          modelUsed: "gpt-4o-mini",
          promptVersion: "ai-analysis:v1",
          timeframe: "4H",
          state: "ACTIONABLE",
          evaluatedCount: 12,
          directionKnownCount: 10,
          directionCorrectCount: 7,
          invalidationKnownCount: 12,
          invalidationHitCount: 2,
          avgPriceChangePercent: 1.35,
        },
      ],
      evaluatedCount: 12,
      pendingCount: 3,
    });

    const response = await app.inject({
      method: "GET",
      url: "/analysis-quality?timeframe=4H&modelUsed=gpt-4o-mini",
    });

    expect(response.statusCode).toBe(200);
    expect(getAnalysisQualitySummary).toHaveBeenCalledWith(
      {
        modelUsed: "gpt-4o-mini",
        timeframe: "4H",
      },
      "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
    );
    expect(response.json()).toMatchObject({
      buckets: [
        {
          modelUsed: "gpt-4o-mini",
          state: "ACTIONABLE",
          evaluatedCount: 12,
          directionCorrectCount: 7,
        },
      ],
      evaluatedCount: 12,
      pendingCount: 3,
    });
  });

  it("returns filtered alerts", async () => {
    vi.mocked(listAlerts).mockResolvedValueOnce([
      {
        id: "alert:crypto:global:BTC-USD:4H:WATCH->ACTIONABLE:signal-hash-btc-4h",
        userId: "system:default",
        assetId: "crypto:global:BTC-USD",
        analysisId: "analysis:latest:crypto:global:BTC-USD:4H",
        transitionId:
          "transition:crypto:global:BTC-USD:4H:WATCH->ACTIONABLE:signal-hash-btc-4h",
        timeframe: "4H",
        dedupeKey:
          "crypto:global:BTC-USD:4H:WATCH->ACTIONABLE:signal-hash-btc-4h",
        kind: "market",
        severity: "critical",
        status: "suggested",
        channels: ["dashboard"],
        title: "BTC/USD actionable setup",
        message:
          "BTC/USD changed from WATCH to ACTIONABLE. Trend remains constructive.",
        summary: "Trend remains constructive.",
        previousState: "WATCH",
        currentState: "ACTIONABLE",
        suggestion: "ENTRY_ON_CONFIRMATION",
        createdAt: "2026-04-21T08:05:00.000Z",
        isStale: false,
        metadata: {},
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/alerts?assetId=crypto:global:BTC-USD&timeframe=4H&status=suggested&limit=10",
    });

    expect(response.statusCode).toBe(200);
    expect(listAlerts).toHaveBeenCalledWith(
      {
        assetId: "crypto:global:BTC-USD",
        limit: 10,
        status: "suggested",
        timeframe: "4H",
      },
      "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
    );
    expect(response.json()).toMatchObject({
      alerts: [
        {
          assetId: "crypto:global:BTC-USD",
          currentState: "ACTIONABLE",
          previousState: "WATCH",
          severity: "critical",
          status: "suggested",
          timeframe: "4H",
        },
      ],
      count: 1,
    });
  });

  it("creates a manual position", async () => {
    vi.mocked(createPosition).mockResolvedValueOnce(createPositionSnapshot());

    const response = await app.inject({
      method: "POST",
      url: "/positions",
      payload: {
        assetId: "crypto:global:BTC-USD",
        direction: "long",
        entryPrice: 84250.5,
        quantity: 0.25,
        stopLoss: 82450,
        thesis: "Breakout continuation after 4H confirmation.",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(createPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: "crypto:global:BTC-USD",
        direction: "long",
        entryPrice: 84250.5,
        quantity: 0.25,
        status: "open",
        userId: "auth-disabled:local",
      }),
      "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
    );
    expect(response.json()).toMatchObject({
      position: {
        assetId: "crypto:global:BTC-USD",
        direction: "long",
        status: "open",
      },
    });
  });

  it("lists active positions with filters", async () => {
    vi.mocked(listPositions).mockResolvedValueOnce([createPositionSnapshot()]);

    const response = await app.inject({
      method: "GET",
      url: "/positions?assetId=crypto:global:BTC-USD&activeOnly=true&limit=10",
    });

    expect(response.statusCode).toBe(200);
    expect(listPositions).toHaveBeenCalledWith(
      {
        activeOnly: true,
        assetId: "crypto:global:BTC-USD",
        limit: 10,
        userId: "auth-disabled:local",
      },
      "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
    );
    expect(response.json()).toMatchObject({
      count: 1,
      positions: [
        {
          id: "position-btc-open",
          status: "open",
        },
      ],
    });
  });

  it("returns the active position for an asset", async () => {
    vi.mocked(getActivePositionForAsset).mockResolvedValueOnce(
      createPositionSnapshot(),
    );

    const response = await app.inject({
      method: "GET",
      url: "/positions/active?assetId=crypto:global:BTC-USD",
    });

    expect(response.statusCode).toBe(200);
    expect(getActivePositionForAsset).toHaveBeenCalledWith({
      assetId: "crypto:global:BTC-USD",
      connectionString:
        "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
      userId: "auth-disabled:local",
    });
    expect(response.json()).toMatchObject({
      position: {
        id: "position-btc-open",
      },
    });
  });

  it("updates a manual position", async () => {
    vi.mocked(updatePosition).mockResolvedValueOnce({
      ...createPositionSnapshot(),
      stopLoss: 83200,
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/positions/position-btc-open",
      payload: {
        stopLoss: 83200,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(updatePosition).toHaveBeenCalledWith(
      "position-btc-open",
      expect.objectContaining({
        stopLoss: 83200,
      }),
      "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
    );
    expect(response.json()).toMatchObject({
      position: {
        stopLoss: 83200,
      },
    });
  });

  it("closes a manual position", async () => {
    vi.mocked(closePosition).mockResolvedValueOnce({
      ...createPositionSnapshot(),
      closedAt: "2026-04-22T08:00:00.000Z",
      remainingQuantity: 0,
      status: "closed",
    });

    const response = await app.inject({
      method: "POST",
      url: "/positions/position-btc-open/close",
      payload: {
        closedAt: "2026-04-22T08:00:00.000Z",
        realizedPnl: 420,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(closePosition).toHaveBeenCalledWith(
      "position-btc-open",
      expect.objectContaining({
        closedAt: "2026-04-22T08:00:00.000Z",
        realizedPnl: 420,
      }),
      "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
    );
    expect(response.json()).toMatchObject({
      position: {
        remainingQuantity: 0,
        status: "closed",
      },
    });
  });

  it("returns a ranked watchlist overview across the seeded crypto assets", async () => {
    const btc = createAsset("crypto:global:BTC-USD", "BTC", "Bitcoin");
    const eth = createAsset("crypto:global:ETH-USD", "ETH", "Ethereum");

    vi.mocked(getLatestMarketData).mockImplementation(async (assetId) => {
      if (assetId === btc.id) {
        return createMarketData(btc, "1H");
      }

      if (assetId === eth.id) {
        return createMarketData(eth, "1H");
      }

      return null;
    });
    vi.mocked(getLatestIndicatorSnapshot).mockImplementation(
      async (assetId) => {
        if (assetId === btc.id) {
          return createIndicatorSnapshot(btc, "1H");
        }

        if (assetId === eth.id) {
          return createIndicatorSnapshot(eth, "1H");
        }

        return null;
      },
    );
    vi.mocked(getLatestSignalAggregationSnapshot).mockImplementation(
      async (assetId) => {
        if (assetId === btc.id) {
          return createSignalSnapshot(btc, "1H");
        }

        if (assetId === eth.id) {
          return createSignalSnapshot(eth, "1H");
        }

        return null;
      },
    );
    vi.mocked(getLatestAssetAnalysis).mockImplementation(async (assetId) => {
      if (assetId === btc.id) {
        return createAnalysisSnapshot(btc, "1H");
      }

      return null;
    });

    const response = await app.inject({
      method: "GET",
      url: "/watchlist/overview?timeframe=1H",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      timeframe: "1H",
      items: [
        {
          asset: {
            id: btc.id,
          },
          status: "ready",
          state: "ACTIONABLE",
          aiConfidence: 78,
          signalStrengthScore: 82,
        },
        {
          asset: {
            id: eth.id,
          },
          status: "partial",
          signalStrengthScore: 82,
          summary:
            "Bullish trend context led by trend alignment and structure.",
        },
        {
          asset: {
            id: "crypto:global:SOL-USD",
          },
          status: "pending",
        },
      ],
    });
  });

  it("returns the aggregated asset overview for a seeded asset", async () => {
    const btc = createAsset("crypto:global:BTC-USD", "BTC", "Bitcoin");

    vi.mocked(getLatestMarketData).mockResolvedValueOnce(
      createMarketData(btc, "4H"),
    );
    vi.mocked(getLatestIndicatorSnapshot).mockResolvedValueOnce(
      createIndicatorSnapshot(btc, "4H"),
    );
    vi.mocked(getLatestSignalAggregationSnapshot).mockResolvedValueOnce(
      createSignalSnapshot(btc, "4H"),
    );
    vi.mocked(getLatestAssetAnalysis).mockResolvedValueOnce(
      createAnalysisSnapshot(btc, "4H"),
    );

    const response = await app.inject({
      method: "GET",
      url: `/assets/${btc.id}/overview?timeframe=4H`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      asset: {
        id: btc.id,
      },
      timeframe: "4H",
      status: "ready",
      marketSnapshot: {
        timeframe: "4H",
      },
      indicatorSnapshot: {
        timeframe: "4H",
      },
      signalSnapshot: {
        signalStrengthScore: 82,
      },
      analysisSnapshot: {
        state: "ACTIONABLE",
        aiConfidence: 78,
      },
    });
  });

  it("returns 404 for an asset overview outside the seeded MVP asset scope", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/assets/crypto:global:XRP-USD/overview?timeframe=1H",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: "ASSET_NOT_FOUND",
      assetId: "crypto:global:XRP-USD",
    });
  });
});

describe("api chat layer routes", () => {
  it("returns a disabled message when the chat layer is not configured", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/chat-layer/twilio/webhook",
      payload:
        "Body=watchlist+4H&From=whatsapp%3A%2B628123&To=whatsapp%3A%2B14155238886",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toContain("WhatsApp chat layer belum dikonfigurasi");
  });

  it("rejects an invalid Twilio signature", async () => {
    const response = await twilioApp.inject({
      method: "POST",
      url: "/chat-layer/twilio/webhook",
      payload:
        "Body=watchlist+4H&From=whatsapp%3A%2B628123&To=whatsapp%3A%2B14155238886",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        host: "api.invalid",
        "x-twilio-signature": "invalid",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "INVALID_TWILIO_SIGNATURE",
    });
  });

  it("returns a watchlist summary for a valid Twilio webhook", async () => {
    const payload =
      "Body=watchlist+4H&From=whatsapp%3A%2B628123&To=whatsapp%3A%2B14155238886";
    const params = {
      Body: "watchlist 4H",
      From: "whatsapp:+628123",
      To: "whatsapp:+14155238886",
    };
    const signature = buildTwilioWebhookSignature({
      authToken: twilioAuthToken,
      params,
      url: twilioWebhookUrl,
    });
    const btc = createAsset("crypto:global:BTC-USD", "BTC", "Bitcoin");

    vi.mocked(getLatestMarketData).mockImplementation(async (assetId) => {
      if (assetId === btc.id) {
        return createMarketData(btc, "4H");
      }

      return null;
    });
    vi.mocked(getLatestIndicatorSnapshot).mockImplementation(
      async (assetId) => {
        if (assetId === btc.id) {
          return createIndicatorSnapshot(btc, "4H");
        }

        return null;
      },
    );
    vi.mocked(getLatestSignalAggregationSnapshot).mockImplementation(
      async (assetId) => {
        if (assetId === btc.id) {
          return createSignalSnapshot(btc, "4H");
        }

        return null;
      },
    );
    vi.mocked(getLatestAssetAnalysis).mockImplementation(async (assetId) => {
      if (assetId === btc.id) {
        return createAnalysisSnapshot(btc, "4H");
      }

      return null;
    });

    const response = await twilioApp.inject({
      method: "POST",
      url: "/chat-layer/twilio/webhook",
      payload,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        host: "api.invalid",
        "x-twilio-signature": signature,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Watchlist 4H");
    expect(response.body).toContain("BTC ACTIONABLE");
  });

  it("records a position from a valid Twilio webhook command", async () => {
    const payload =
      "Body=position+btc+long+entry+84000+qty+0.10+stop+82000&From=whatsapp%3A%2B628123&To=whatsapp%3A%2B14155238886&MessageSid=SM123";
    const params = {
      Body: "position btc long entry 84000 qty 0.10 stop 82000",
      From: "whatsapp:+628123",
      MessageSid: "SM123",
      To: "whatsapp:+14155238886",
    };
    const signature = buildTwilioWebhookSignature({
      authToken: twilioAuthToken,
      params,
      url: twilioWebhookUrl,
    });

    const response = await twilioApp.inject({
      method: "POST",
      url: "/chat-layer/twilio/webhook",
      payload,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        host: "api.invalid",
        "x-twilio-signature": signature,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(vi.mocked(createPosition)).toHaveBeenCalledOnce();
    expect(vi.mocked(createPosition).mock.calls[0]?.[0]).toMatchObject({
      assetId: "crypto:global:BTC-USD",
      direction: "long",
      entryPrice: 84000,
      quantity: 0.1,
      stopLoss: 82000,
      userId: twilioChatUserId,
      metadata: {
        channel: "whatsapp",
        provider: "twilio",
        requestedTimeframe: "4H",
        sourceFrom: "whatsapp:+628123",
        sourceMessageSid: "SM123",
      },
    });
    expect(response.body).toContain("position recorded");
  });
});

describe("api telegram chat layer routes", () => {
  it("returns 503 when the Telegram chat layer is not configured", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/chat-layer/telegram/webhook",
      payload: {
        message: {
          chat: { id: 8786340516 },
          message_id: 1,
          text: "watchlist 4H",
        },
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: "TELEGRAM_CHAT_LAYER_DISABLED",
    });
  });

  it("rejects an invalid webhook secret", async () => {
    const response = await telegramApp.inject({
      method: "POST",
      url: "/chat-layer/telegram/webhook",
      payload: {
        message: {
          chat: { id: 8786340516 },
          message_id: 1,
          text: "watchlist 4H",
        },
      },
      headers: {
        "x-telegram-bot-api-secret-token": "wrong-secret",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "INVALID_TELEGRAM_WEBHOOK_SECRET",
    });
  });

  it("ignores updates from chats outside the allowed chat id", async () => {
    const response = await telegramApp.inject({
      method: "POST",
      url: "/chat-layer/telegram/webhook",
      payload: {
        message: {
          chat: { id: 999 },
          message_id: 1,
          text: "watchlist 4H",
        },
      },
      headers: {
        "x-telegram-bot-api-secret-token": telegramWebhookSecret,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      skipped: "chat_not_allowed",
    });
  });

  it("acknowledges non-text updates without replying", async () => {
    const response = await telegramApp.inject({
      method: "POST",
      url: "/chat-layer/telegram/webhook",
      payload: {
        message: {
          chat: { id: 8786340516 },
          message_id: 2,
        },
      },
      headers: {
        "x-telegram-bot-api-secret-token": telegramWebhookSecret,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      skipped: "unsupported_update",
    });
  });
});

afterAll(async () => {
  await app.close();
  await twilioApp.close();
  await telegramApp.close();
});
