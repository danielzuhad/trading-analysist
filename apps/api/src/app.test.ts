import {
  getLatestAssetAnalysis,
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  getLatestSignalAggregationSnapshot,
  listAlerts,
  listServiceHeartbeats,
  pingDatabase,
} from "@trading-analyst/db";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

vi.mock("@trading-analyst/db", () => ({
  closeDatabase: vi.fn(async () => undefined),
  getLatestAssetAnalysis: vi.fn(async () => null),
  getLatestIndicatorSnapshot: vi.fn(async () => null),
  getLatestMarketData: vi.fn(async () => null),
  getLatestSignalAggregationSnapshot: vi.fn(async () => null),
  listAlerts: vi.fn(async () => []),
  listServiceHeartbeats: vi.fn(async () => []),
  pingDatabase: vi.fn(async () => undefined),
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
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
  REDIS_URL: "redis://127.0.0.1:6379",
});

afterEach(() => {
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
  vi.mocked(listServiceHeartbeats).mockReset();
  vi.mocked(listServiceHeartbeats).mockResolvedValue([]);
  vi.mocked(pingDatabase).mockReset();
  vi.mocked(pingDatabase).mockResolvedValue(undefined);
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

afterAll(async () => {
  await app.close();
});
