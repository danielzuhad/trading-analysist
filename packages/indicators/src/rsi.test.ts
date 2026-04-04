import { describe, expect, it } from "vitest";
import { calculateRelativeStrengthIndex } from "./rsi.js";

describe("calculateRelativeStrengthIndex", () => {
  it("returns 50 for a flat series", () => {
    const values = Array.from({ length: 20 }, () => 100);

    expect(calculateRelativeStrengthIndex(values, 14)).toBe(50);
  });

  it("returns a strong RSI reading for a persistent uptrend", () => {
    const values = Array.from({ length: 20 }, (_, index) => 100 + index);

    expect(calculateRelativeStrengthIndex(values, 14)).toBeGreaterThan(70);
  });
});
