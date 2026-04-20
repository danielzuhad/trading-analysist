import type { SignalAggregationSnapshot } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import {
  parseLatestSignalAggregationSnapshot,
  serializeLatestSignalAggregationSnapshot,
} from "./signal-aggregation.js";

const generatedAt = "2026-04-10T12:01:00.000Z";

describe("latest signal aggregation snapshot serialization", () => {
  it("round-trips a signal aggregation snapshot through the storage mapper", () => {
    const source: SignalAggregationSnapshot = {
      id: "signal:crypto:global:BTC-USD:1H:2026-04-10T12:01:00.000Z",
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
        capturedAt: generatedAt,
        lastPrice: 84610,
        candle: {
          open: 84250,
          high: 84880,
          low: 84100,
          close: 84610,
          volume: 2680,
        },
        marketSession: "continuous",
        eventFlags: [],
        metadata: {},
      },
      indicatorSnapshot: {
        id: "indicator:crypto:global:BTC-USD:1H",
        assetId: "crypto:global:BTC-USD",
        timeframe: "1H",
        calculatedAt: generatedAt,
        movingAverages: {
          ema20: 84210,
          ema50: 83820,
          ema200: 80155,
        },
        oscillators: {
          rsi14: 62.4,
        },
        volatility: {
          atr14: 1210.5,
          atrPercent: 1.43,
          baseline: 1.2,
          regime: "expanded",
        },
        volume: {
          current: 2680,
          average20: 2140,
          relativeVolume: 1.25,
          trend: "up",
        },
        levels: {
          support: [83200, 82450],
          resistance: [84880, 85520],
        },
        structure: "uptrend",
        metadata: {},
      },
      generatedAt,
      signalStrengthScore: 82,
      bias: "bullish",
      regime: "trend",
      timeframeRelevance:
        "Fast confirmation layer for crypto watchlist monitoring.",
      riskFlags: ["price_near_resistance"],
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
    };

    const stored = serializeLatestSignalAggregationSnapshot(source);
    const roundTrip = parseLatestSignalAggregationSnapshot({
      ...stored,
      position: stored.position ?? null,
      generatedAt: new Date(generatedAt),
      updatedAt: new Date(generatedAt),
    });

    expect(roundTrip).toEqual(source);
  });
});
