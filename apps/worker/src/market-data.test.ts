import { describe, expect, it, vi } from "vitest";
import {
  defaultCryptoWatchlistAssets,
  ingestLatestMarketData,
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

  it("fetches and persists latest market data through injectable dependencies", async () => {
    const fetchMarketData = vi.fn(async () => marketDataFixture);
    const persistLatestMarketData = vi.fn(async () => marketDataFixture);
    const asset = defaultCryptoWatchlistAssets[0]!;

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
});
