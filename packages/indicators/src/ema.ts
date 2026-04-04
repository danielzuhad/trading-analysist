import { assertMinimumLength, assertPositiveInteger, average } from "./math.js";

export function calculateExponentialMovingAverage(
  values: number[],
  period: number,
) {
  assertPositiveInteger("EMA period", period);
  assertMinimumLength("EMA", values.length, period);

  const multiplier = 2 / (period + 1);
  let ema = average(values.slice(0, period));

  for (const value of values.slice(period)) {
    ema = (value - ema) * multiplier + ema;
  }

  return ema;
}
