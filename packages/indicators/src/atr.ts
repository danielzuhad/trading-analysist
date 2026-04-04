import type { MarketCandle } from "@trading-analyst/shared-types";
import { IndicatorCalculationError } from "./errors.js";
import {
  assertMinimumLength,
  assertPositiveInteger,
  average,
  lastValue,
  requireDefined,
} from "./math.js";

export function calculateTrueRange(
  candle: MarketCandle,
  previousClose: number,
) {
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previousClose),
    Math.abs(candle.low - previousClose),
  );
}

export function calculateAverageTrueRangeSeries(
  candles: MarketCandle[],
  period = 14,
) {
  assertPositiveInteger("ATR period", period);
  assertMinimumLength("ATR", candles.length, period + 1);

  const trueRanges = candles
    .slice(1)
    .map((candle, index) =>
      calculateTrueRange(
        candle,
        requireDefined(candles[index], "Previous ATR candle").close,
      ),
    );

  let atr = average(trueRanges.slice(0, period));
  const series = [atr];

  for (const trueRange of trueRanges.slice(period)) {
    atr = (atr * (period - 1) + trueRange) / period;
    series.push(atr);
  }

  return series;
}

export function calculateAverageTrueRange(
  candles: MarketCandle[],
  period = 14,
) {
  return lastValue(calculateAverageTrueRangeSeries(candles, period), "ATR");
}

export function calculateAtrPercent(atr: number, close: number) {
  if (close <= 0) {
    throw new IndicatorCalculationError(
      "ATR percent requires a positive close value",
      {
        close,
      },
    );
  }

  return (atr / close) * 100;
}
