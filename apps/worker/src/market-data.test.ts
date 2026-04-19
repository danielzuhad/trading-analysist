import { describe, expect, it, vi } from "vitest";
import {
  defaultCryptoWatchlistAssets,
  findDefaultCryptoAsset,
  ingestLatestMarketData,
  processMarketSnapshotJob,
} from "./market-data.js";

const marketDataFixture = {
  series: {
    assetId: "crypto:global:BTC-USD",
    provider: "twelve-data",
    timeframe: "1H" as const,
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
    marketSession: "continuous" as const,
    eventFlags: [],
    metadata: {},
  },
  snapshot: {
    id: "market:twelve-data:crypto:global:BTC-USD:1H",
    assetId: "crypto:global:BTC-USD",
    provider: "twelve-data",
    timeframe: "1H" as const,
    capturedAt: "2026-04-04T04:00:00.000Z",
    lastPrice: 84250.5,
    candle: {
      open: 84180.7,
      high: 84420.2,
      low: 84090.4,
      close: 84250.5,
      volume: 1310.4,
    },
    marketSession: "continuous" as const,
    eventFlags: [],
    metadata: {},
  },
};

const indicatorSnapshotFixture = {
  id: "indicator:crypto:global:BTC-USD:1H",
  assetId: "crypto:global:BTC-USD",
  timeframe: "1H" as const,
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

const signalAggregationSnapshotFixture = {
  id: "signal:crypto:global:BTC-USD:1H:2026-04-04T04:00:00.000Z",
  asset: {
    id: "crypto:global:BTC-USD",
    symbol: "BTC",
    displaySymbol: "BTC/USD",
    name: "Bitcoin",
    assetClass: "crypto" as const,
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
  indicatorSnapshot: indicatorSnapshotFixture,
  generatedAt: "2026-04-04T04:00:00.000Z",
  signalStrengthScore: 82,
  bias: "bullish" as const,
  regime: "trend" as const,
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
      sentiment: "bullish" as const,
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

describe("market-data ingestion prep", () => {
  it("ships with a default crypto watchlist seed for the MVP", () => {
    expect(defaultCryptoWatchlistAssets.map((asset) => asset.symbol)).toEqual([
      "BTC",
      "ETH",
      "SOL",
    ]);
  });

  it("can resolve a supported default asset by id", () => {
    expect(findDefaultCryptoAsset("crypto:global:ETH-USD")?.symbol).toBe("ETH");
    expect(findDefaultCryptoAsset("crypto:global:XRP-USD")).toBeUndefined();
  });

  it("fetches and persists latest market data through injectable dependencies", async () => {
    const fetchMarketData = vi.fn(async () => marketDataFixture);
    const buildIndicator = vi.fn(() => indicatorSnapshotFixture);
    const buildSignalAggregation = vi.fn(
      () => signalAggregationSnapshotFixture,
    );
    const persistLatestIndicatorSnapshot = vi.fn(
      async () => indicatorSnapshotFixture,
    );
    const persistLatestMarketData = vi.fn(async () => marketDataFixture);
    const persistLatestSignalAggregationSnapshot = vi.fn(
      async () => signalAggregationSnapshotFixture,
    );
    const asset = defaultCryptoWatchlistAssets[0];

    if (!asset) {
      throw new Error("Expected the default crypto watchlist to include BTC.");
    }

    const result = await ingestLatestMarketData({
      apiKey: "test-key",
      asset,
      buildIndicator,
      buildSignalAggregation,
      connectionString: "postgresql://db.invalid/trading_analyst",
      fetchService: {
        fetchMarketData,
      },
      persistLatestIndicatorSnapshot,
      persistLatestMarketData,
      persistLatestSignalAggregationSnapshot,
      timeframe: "1H",
    });

    expect(fetchMarketData).toHaveBeenCalledWith({
      asset,
      timeframe: "1H",
    });
    expect(persistLatestMarketData).toHaveBeenCalledWith(
      marketDataFixture,
      "postgresql://db.invalid/trading_analyst",
    );
    expect(buildIndicator).toHaveBeenCalledWith(marketDataFixture.series);
    expect(buildSignalAggregation).toHaveBeenCalledWith({
      asset,
      indicatorSnapshot: indicatorSnapshotFixture,
      marketData: marketDataFixture,
    });
    expect(persistLatestIndicatorSnapshot).toHaveBeenCalledWith(
      indicatorSnapshotFixture,
      "postgresql://db.invalid/trading_analyst",
    );
    expect(persistLatestSignalAggregationSnapshot).toHaveBeenCalledWith(
      signalAggregationSnapshotFixture,
      "postgresql://db.invalid/trading_analyst",
    );
    expect(result.marketData.snapshot.assetId).toBe("crypto:global:BTC-USD");
    expect(result.indicatorSnapshot.structure).toBe("uptrend");
    expect(result.signalAggregationSnapshot.signalStrengthScore).toBe(82);
  });

  it("skips a market snapshot job when the API key is missing", async () => {
    const warn = vi.fn();

    const result = await processMarketSnapshotJob({
      assetId: "crypto:global:BTC-USD",
      logger: {
        error: vi.fn(),
        log: vi.fn(),
        warn,
      },
      requestedAt: "2026-04-04T04:00:00.000Z",
      timeframe: "1H",
    });

    expect(result).toEqual({
      assetId: "crypto:global:BTC-USD",
      reason: "missing_api_key",
      requestedAt: "2026-04-04T04:00:00.000Z",
      status: "skipped",
      timeframe: "1H",
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("stores a market snapshot job when dependencies are available", async () => {
    const fetchMarketData = vi.fn(async () => marketDataFixture);
    const buildIndicator = vi.fn(() => indicatorSnapshotFixture);
    const buildSignalAggregation = vi.fn(
      () => signalAggregationSnapshotFixture,
    );
    const persistLatestIndicatorSnapshot = vi.fn(
      async () => indicatorSnapshotFixture,
    );
    const persistLatestMarketData = vi.fn(async () => marketDataFixture);
    const persistLatestSignalAggregationSnapshot = vi.fn(
      async () => signalAggregationSnapshotFixture,
    );
    const log = vi.fn();

    const result = await processMarketSnapshotJob({
      apiKey: "test-key",
      assetId: "crypto:global:BTC-USD",
      buildIndicator,
      buildSignalAggregation,
      connectionString: "postgresql://db.invalid/trading_analyst",
      fetchService: {
        fetchMarketData,
      },
      logger: {
        error: vi.fn(),
        log,
        warn: vi.fn(),
      },
      persistLatestIndicatorSnapshot,
      persistLatestMarketData,
      persistLatestSignalAggregationSnapshot,
      requestedAt: "2026-04-04T04:00:00.000Z",
      timeframe: "1H",
    });

    expect(result).toEqual({
      assetId: "crypto:global:BTC-USD",
      indicatorSnapshotId: "indicator:crypto:global:BTC-USD:1H",
      requestedAt: "2026-04-04T04:00:00.000Z",
      snapshotId: "market:twelve-data:crypto:global:BTC-USD:1H",
      signalBias: "bullish",
      signalSnapshotId:
        "signal:crypto:global:BTC-USD:1H:2026-04-04T04:00:00.000Z",
      signalStrengthScore: 82,
      status: "stored",
      timeframe: "1H",
    });
    expect(buildIndicator).toHaveBeenCalledWith(marketDataFixture.series);
    expect(buildSignalAggregation).toHaveBeenCalledWith({
      asset: defaultCryptoWatchlistAssets[0],
      indicatorSnapshot: indicatorSnapshotFixture,
      marketData: marketDataFixture,
    });
    expect(log).toHaveBeenCalledOnce();
  });
});
