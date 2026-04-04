import { describe, expect, it } from "vitest";
import { calculateExponentialMovingAverage } from "./ema.js";
import { IndicatorCalculationError } from "./errors.js";

describe("calculateExponentialMovingAverage", () => {
  it("returns the constant price for a flat series", () => {
    const values = Array.from({ length: 30 }, () => 10);

    expect(calculateExponentialMovingAverage(values, 20)).toBe(10);
  });

  it("rejects series that are shorter than the requested lookback", () => {
    expect(() => calculateExponentialMovingAverage([1, 2, 3], 5)).toThrowError(
      IndicatorCalculationError,
    );
  });
});
