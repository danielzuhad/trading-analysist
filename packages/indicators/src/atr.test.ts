import { describe, expect, it } from "vitest";
import {
  calculateAtrPercent,
  calculateAverageTrueRange,
  calculateAverageTrueRangeSeries,
} from "./atr.js";
import { buildCandlesFromCloses } from "./test-fixtures.js";

describe("average true range", () => {
  it("returns a stable ATR for a flat range series", () => {
    const candles = buildCandlesFromCloses(
      Array.from({ length: 20 }, () => 100),
    );

    expect(calculateAverageTrueRange(candles, 14)).toBeCloseTo(2, 8);
    expect(calculateAverageTrueRangeSeries(candles, 14)).toHaveLength(6);
  });

  it("converts ATR into a percentage of the latest close", () => {
    expect(calculateAtrPercent(2, 100)).toBe(2);
  });
});
