import { describe, expect, it } from "vitest";
import {
  type LatestMarketData,
  parseLatestMarketData,
  serializeLatestMarketData,
} from "./market-data.js";

const capturedAt = "2026-04-04T04:00:00.000Z";

describe("latest market data serialization", () => {
  it("round-trips normalized market data through the storage mapper", () => {
    const source: LatestMarketData = {
      series: {
        assetId: "crypto:global:BTC-USD",
        provider: "twelve-data",
        timeframe: "1H",
        capturedAt,
        lastPrice: 84250.5,
        bidPrice: 84249.9,
        askPrice: 84251.1,
        candles: [
          {
            timestamp: "2026-04-04T03:00:00.000Z",
            open: 83910.2,
            high: 84300.5,
            low: 83850.1,
            close: 84180.7,
            volume: 1245.8,
          },
          {
            timestamp: capturedAt,
            open: 84180.7,
            high: 84420.2,
            low: 84090.4,
            close: 84250.5,
            volume: 1310.4,
          },
        ],
        marketSession: "continuous",
        priceChangePercent: 0.88,
        volumeWeightedAveragePrice: 84140.3,
        quoteCurrency: "USD",
        baseCurrency: "BTC",
        eventFlags: ["near_resistance"],
        metadata: {
          isStale: false,
        },
      },
      snapshot: {
        id: "market:twelve-data:crypto:global:BTC-USD:1H",
        assetId: "crypto:global:BTC-USD",
        provider: "twelve-data",
        timeframe: "1H",
        capturedAt,
        lastPrice: 84250.5,
        bidPrice: 84249.9,
        askPrice: 84251.1,
        candle: {
          open: 84180.7,
          high: 84420.2,
          low: 84090.4,
          close: 84250.5,
          volume: 1310.4,
        },
        marketSession: "continuous",
        priceChangePercent: 0.88,
        volumeWeightedAveragePrice: 84140.3,
        quoteCurrency: "USD",
        baseCurrency: "BTC",
        eventFlags: ["near_resistance"],
        metadata: {
          isStale: false,
        },
      },
    };

    const stored = serializeLatestMarketData(source);
    const roundTrip = parseLatestMarketData({
      ...stored,
      askPrice: stored.askPrice ?? null,
      baseCurrency: stored.baseCurrency ?? null,
      bidPrice: stored.bidPrice ?? null,
      capturedAt: new Date(capturedAt),
      priceChangePercent: stored.priceChangePercent ?? null,
      quoteCurrency: stored.quoteCurrency ?? null,
      updatedAt: new Date(capturedAt),
      volumeWeightedAveragePrice: stored.volumeWeightedAveragePrice ?? null,
    });

    expect(roundTrip).toEqual(source);
  });

  it("preserves missing optional numeric fields", () => {
    const source: LatestMarketData = {
      series: {
        assetId: "crypto:global:ETH-USD",
        provider: "twelve-data",
        timeframe: "4H",
        capturedAt,
        lastPrice: 1834.2,
        candles: [
          {
            timestamp: capturedAt,
            open: 1810.5,
            high: 1840.1,
            low: 1808.9,
            close: 1834.2,
            volume: 0,
          },
        ],
        marketSession: "continuous",
        eventFlags: [],
        metadata: {},
      },
      snapshot: {
        id: "market:twelve-data:crypto:global:ETH-USD:4H",
        assetId: "crypto:global:ETH-USD",
        provider: "twelve-data",
        timeframe: "4H",
        capturedAt,
        lastPrice: 1834.2,
        candle: {
          open: 1810.5,
          high: 1840.1,
          low: 1808.9,
          close: 1834.2,
          volume: 0,
        },
        marketSession: "continuous",
        eventFlags: [],
        metadata: {},
      },
    };

    const stored = serializeLatestMarketData(source);
    const roundTrip = parseLatestMarketData({
      ...stored,
      askPrice: stored.askPrice ?? null,
      baseCurrency: stored.baseCurrency ?? null,
      bidPrice: stored.bidPrice ?? null,
      capturedAt: new Date(capturedAt),
      priceChangePercent: stored.priceChangePercent ?? null,
      quoteCurrency: stored.quoteCurrency ?? null,
      updatedAt: new Date(capturedAt),
      volumeWeightedAveragePrice: stored.volumeWeightedAveragePrice ?? null,
    });

    expect(roundTrip.snapshot.bidPrice).toBeUndefined();
    expect(roundTrip.snapshot.askPrice).toBeUndefined();
    expect(roundTrip.snapshot.priceChangePercent).toBeUndefined();
  });
});
