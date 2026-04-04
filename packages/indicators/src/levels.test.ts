import { describe, expect, it } from "vitest";
import { findSupportResistanceLevels } from "./levels.js";
import { buildCandlesFromCloses } from "./test-fixtures.js";

describe("findSupportResistanceLevels", () => {
  it("returns descending supports and ascending resistances around the latest close", () => {
    const candles = buildCandlesFromCloses([
      100, 104, 101, 107, 103, 109, 105, 111, 107, 114, 110,
    ]);

    const levels = findSupportResistanceLevels(candles, {
      maxLevels: 2,
      pivotLookback: 1,
      recentWindow: 8,
    });

    expect(levels.support.length).toBeGreaterThan(0);
    expect(levels.resistance.length).toBeGreaterThan(0);
    expect(levels.support[0]).toBeLessThan(110);
    expect(levels.resistance[0]).toBeGreaterThan(110);
    expect(levels.support).toEqual(
      [...levels.support].sort((left, right) => right - left),
    );
    expect(levels.resistance).toEqual(
      [...levels.resistance].sort((left, right) => left - right),
    );
  });
});
