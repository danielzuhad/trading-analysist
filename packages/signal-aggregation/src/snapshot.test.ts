import {
  assetSchema,
  indicatorSnapshotSchema,
  marketSnapshotSchema,
  positionSchema,
} from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import {
  buildSignalAggregationSnapshot,
  buildSignalAggregationSnapshotHash,
} from "./snapshot.js";

const asset = assetSchema.parse({
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
});

const marketSnapshot = marketSnapshotSchema.parse({
  id: "market:coingecko:crypto:global:BTC-USD:1H",
  assetId: asset.id,
  provider: "coingecko",
  timeframe: "1H",
  capturedAt: "2026-04-10T12:00:00.000Z",
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
});

const indicatorSnapshot = indicatorSnapshotSchema.parse({
  id: "indicator:crypto:global:BTC-USD:1H",
  assetId: asset.id,
  timeframe: "1H",
  calculatedAt: "2026-04-10T12:00:00.000Z",
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
});

describe("buildSignalAggregationSnapshot", () => {
  it("assembles a deterministic signal snapshot for AI-ready analysis input", () => {
    const snapshot = buildSignalAggregationSnapshot({
      asset,
      generatedAt: "2026-04-10T12:01:00.000Z",
      indicatorSnapshot,
      marketSnapshot,
    });

    expect(snapshot.signalStrengthScore).toBeGreaterThanOrEqual(70);
    expect(snapshot.bias).toBe("bullish");
    expect(snapshot.regime).toBe("trend");
    expect(snapshot.labels).toHaveLength(5);
    expect(snapshot.keyLevels.nearestSupport).toBe(83200);
    expect(snapshot.keyLevels.nearestResistance).toBe(84880);
    expect(snapshot.snapshotHash).toHaveLength(64);
  });

  it("surfaces position-aware invalidation and risk flags", () => {
    const position = positionSchema.parse({
      id: "position-btc-open",
      userId: "user-123",
      assetId: asset.id,
      direction: "long",
      status: "open",
      entryPrice: 84500,
      averageEntryPrice: 84480,
      quantity: 0.25,
      remainingQuantity: 0.25,
      stopLoss: 83850,
      takeProfitLevels: [],
      openedAt: "2026-04-10T10:00:00.000Z",
      lastUpdatedAt: "2026-04-10T12:01:00.000Z",
      isBackfilled: false,
      metadata: {},
    });

    const stressedMarketSnapshot = marketSnapshotSchema.parse({
      ...marketSnapshot,
      candle: {
        ...marketSnapshot.candle,
        close: 84010,
      },
      lastPrice: 84010,
    });

    const snapshot = buildSignalAggregationSnapshot({
      asset,
      generatedAt: "2026-04-10T12:02:00.000Z",
      indicatorSnapshot,
      marketSnapshot: stressedMarketSnapshot,
      position,
    });

    expect(snapshot.keyLevels.invalidation).toBe(position.stopLoss);
    expect(snapshot.riskFlags).toContain("position_near_invalidation");
  });

  it("builds a stable hash for identical logical content", () => {
    const first = buildSignalAggregationSnapshot({
      asset,
      generatedAt: "2026-04-10T12:01:00.000Z",
      indicatorSnapshot,
      marketSnapshot,
    });
    const second = buildSignalAggregationSnapshot({
      asset,
      generatedAt: "2026-04-10T12:01:00.000Z",
      indicatorSnapshot,
      marketSnapshot,
    });

    expect(buildSignalAggregationSnapshotHash(first)).toBe(
      buildSignalAggregationSnapshotHash(second),
    );
  });

  it("rejects mismatched asset sources", () => {
    expect(() =>
      buildSignalAggregationSnapshot({
        asset: {
          ...asset,
          id: "crypto:global:ETH-USD",
        },
        indicatorSnapshot,
        marketSnapshot,
      }),
    ).toThrowError(/asset\.id/);
  });
});
