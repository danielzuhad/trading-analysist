import type { IndicatorSnapshot } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import {
  parseLatestIndicatorSnapshot,
  serializeLatestIndicatorSnapshot,
} from "./indicators.js";

const calculatedAt = "2026-04-04T04:00:00.000Z";

describe("latest indicator snapshot serialization", () => {
  it("round-trips a normalized indicator snapshot through the storage mapper", () => {
    const source: IndicatorSnapshot = {
      id: "indicator:crypto:global:BTC-USD:1H",
      assetId: "crypto:global:BTC-USD",
      timeframe: "1H",
      calculatedAt,
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
      metadata: {
        sourceProvider: "coingecko",
      },
    };

    const stored = serializeLatestIndicatorSnapshot(source);
    const roundTrip = parseLatestIndicatorSnapshot({
      ...stored,
      calculatedAt: new Date(calculatedAt),
      updatedAt: new Date(calculatedAt),
    });

    expect(roundTrip).toEqual(source);
  });
});
