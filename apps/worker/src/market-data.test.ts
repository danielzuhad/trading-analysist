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
    const persistLatestMarketData = vi.fn(async () => marketDataFixture);
    const asset = defaultCryptoWatchlistAssets[0];

    if (!asset) {
      throw new Error("Expected the default crypto watchlist to include BTC.");
    }

    const result = await ingestLatestMarketData({
      apiKey: "test-key",
      asset,
      connectionString: "postgresql://db.invalid/trading_analyst",
      fetchService: {
        fetchMarketData,
      },
      persistLatestMarketData,
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
    expect(result.snapshot.assetId).toBe("crypto:global:BTC-USD");
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
    const persistLatestMarketData = vi.fn(async () => marketDataFixture);
    const log = vi.fn();

    const result = await processMarketSnapshotJob({
      apiKey: "test-key",
      assetId: "crypto:global:BTC-USD",
      connectionString: "postgresql://db.invalid/trading_analyst",
      fetchService: {
        fetchMarketData,
      },
      logger: {
        error: vi.fn(),
        log,
        warn: vi.fn(),
      },
      persistLatestMarketData,
      requestedAt: "2026-04-04T04:00:00.000Z",
      timeframe: "1H",
    });

    expect(result).toEqual({
      assetId: "crypto:global:BTC-USD",
      requestedAt: "2026-04-04T04:00:00.000Z",
      snapshotId: "market:twelve-data:crypto:global:BTC-USD:1H",
      status: "stored",
      timeframe: "1H",
    });
    expect(log).toHaveBeenCalledOnce();
  });
});
