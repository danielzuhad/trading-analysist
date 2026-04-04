import { describe, expect, it } from "vitest";
import { buildIndicatorSnapshot } from "./snapshot.js";
import { createOscillatingUptrendSeries } from "./test-fixtures.js";

describe("buildIndicatorSnapshot", () => {
  it("builds a typed indicator snapshot from normalized market candles", () => {
    const marketSeries = createOscillatingUptrendSeries();
    const snapshot = buildIndicatorSnapshot({
      marketSeries,
    });

    expect(snapshot.id).toBe("indicator:crypto:global:BTC-USD:1H");
    expect(snapshot.movingAverages.ema20).toBeGreaterThan(
      snapshot.movingAverages.ema50,
    );
    expect(snapshot.movingAverages.ema50).toBeGreaterThan(
      snapshot.movingAverages.ema200,
    );
    expect(snapshot.oscillators.rsi14).toBeGreaterThan(50);
    expect(snapshot.volatility.baseline).toBeGreaterThan(0);
    expect(snapshot.volume.average20).toBeGreaterThan(0);
    expect(snapshot.levels.support.length).toBeGreaterThan(0);
    expect(snapshot.structure).toBe("uptrend");
  });
});
