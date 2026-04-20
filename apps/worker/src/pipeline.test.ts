import type { LatestMarketData } from "@trading-analyst/db";
import type {
  IndicatorSnapshot,
  MarketContextSnapshot,
  SignalAggregationSnapshot,
} from "@trading-analyst/shared-types";
import { describe, expect, it, vi } from "vitest";
import { runAnalysisCycle } from "./pipeline.js";

const assetId = "crypto:global:BTC-USD";
const requestedAt = "2026-04-20T08:00:00.000Z";

const marketContextFixture: MarketContextSnapshot = {
  id: `context:${assetId}:4H:${requestedAt}`,
  assetId,
  timeframe: "4H",
  generatedAt: requestedAt,
  isPartial: true,
  missingProviders: ["cryptopanic"],
  providers: [
    {
      provider: "fear-and-greed",
      status: "active",
      checkedAt: requestedAt,
      metadata: {},
    },
    {
      provider: "bybit",
      status: "active",
      checkedAt: requestedAt,
      metadata: {},
    },
    {
      provider: "coingecko",
      status: "active",
      checkedAt: requestedAt,
      metadata: {},
    },
    {
      provider: "cryptopanic",
      status: "disabled",
      checkedAt: requestedAt,
      detail: "CRYPTOPANIC_API_TOKEN is not configured.",
      metadata: {},
    },
  ],
  btcDominancePercent: 52.3,
  totalMarketCapUsd: 2_600_000_000_000,
  totalVolume24hUsd: 88_000_000_000,
  sentiment: {
    classification: "Fear",
    value: 32,
  },
  metadata: {},
};

const marketDataFixture: LatestMarketData = {
  series: {
    assetId,
    provider: "twelve-data",
    timeframe: "4H",
    capturedAt: requestedAt,
    lastPrice: 84250.5,
    candles: [
      {
        timestamp: requestedAt,
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
    id: `market:twelve-data:${assetId}:4H`,
    assetId,
    provider: "twelve-data",
    timeframe: "4H",
    capturedAt: requestedAt,
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
};

const indicatorFixture: IndicatorSnapshot = {
  id: `indicator:${assetId}:4H`,
  assetId,
  timeframe: "4H",
  calculatedAt: requestedAt,
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
};

const signalAggregationFixture: SignalAggregationSnapshot = {
  id: `signal:${assetId}:4H:${requestedAt}`,
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
  marketSnapshot: marketDataFixture.snapshot,
  indicatorSnapshot: indicatorFixture,
  marketContext: marketContextFixture,
  generatedAt: requestedAt,
  signalStrengthScore: 82,
  bias: "bullish",
  regime: "trend",
  timeframeRelevance:
    "Higher-timeframe swing context for crypto watchlist monitoring.",
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
      details: "Price holds above a fully bullish EMA20/EMA50/EMA200 stack.",
    },
  ],
  summary: "Bullish trend context led by trend alignment and structure.",
  snapshotHash: "signal-hash-btc-4h",
  metadata: {
    signalAggregationVersion: "signal-aggregation:v1",
  },
};

describe("worker analysis pipeline", () => {
  it("runs the full cycle and persists provider plus AI heartbeats", async () => {
    const saveHeartbeat = vi.fn(async (heartbeat) => ({
      checkedAt: heartbeat.checkedAt ?? requestedAt,
      payload: heartbeat.payload ?? null,
      serviceName: heartbeat.serviceName,
      status: heartbeat.status,
    }));

    const result = await runAnalysisCycle({
      assetId,
      contextService: {
        fetchContext: vi.fn(async () => marketContextFixture),
      },
      generateAnalysisFromSignalSnapshotFn: vi.fn(async () => ({
        analysisId: "analysis:latest:crypto:global:BTC-USD:4H",
        assetId,
        state: "ACTIONABLE" as const,
        status: "stored" as const,
        timeframe: "4H" as const,
      })),
      ingestLatestMarketDataFn: vi.fn(async () => ({
        indicatorSnapshot: indicatorFixture,
        marketData: marketDataFixture,
        signalAggregationSnapshot: signalAggregationFixture,
      })),
      logger: {
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
      },
      marketFetchApiKey: "test-key",
      requestedAt,
      saveHeartbeat,
      timeframe: "4H",
    });

    expect(result).toMatchObject({
      assetId,
      contextPartial: true,
      marketStatus: "stored",
      status: "stored",
      timeframe: "4H",
    });
    expect(saveHeartbeat).toHaveBeenCalledTimes(5);
    expect(saveHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: "provider:cryptopanic",
        status: "disabled",
      }),
      undefined,
    );
    expect(saveHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: "ai:daily-cost-cap",
        status: "ok",
      }),
      undefined,
    );
  });

  it("skips unsupported assets before any external work starts", async () => {
    const contextService = {
      fetchContext: vi.fn(),
    };

    const result = await runAnalysisCycle({
      assetId: "crypto:global:XRP-USD",
      contextService,
      logger: {
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
      },
      marketFetchApiKey: "test-key",
      requestedAt,
      timeframe: "4H",
    });

    expect(result).toEqual({
      assetId: "crypto:global:XRP-USD",
      reason: "asset_not_supported",
      status: "skipped",
      timeframe: "4H",
    });
    expect(contextService.fetchContext).not.toHaveBeenCalled();
  });
});
