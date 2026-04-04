import {
  type MarketCandle,
  type SupportResistanceSnapshot,
  supportResistanceSnapshotSchema,
} from "@trading-analyst/shared-types";
import { assertMinimumLength, assertPositiveInteger } from "./math.js";

export type SupportResistanceOptions = {
  maxLevels?: number;
  minDistancePercent?: number;
  pivotLookback?: number;
  recentWindow?: number;
};

export function findSupportResistanceLevels(
  candles: MarketCandle[],
  options: SupportResistanceOptions = {},
): SupportResistanceSnapshot {
  const {
    maxLevels = 3,
    minDistancePercent = 0.5,
    pivotLookback = 2,
    recentWindow = 20,
  } = options;

  assertPositiveInteger("maxLevels", maxLevels);
  assertPositiveInteger("pivotLookback", pivotLookback);
  assertPositiveInteger("recentWindow", recentWindow);
  assertMinimumLength(
    "Support/resistance",
    candles.length,
    pivotLookback * 2 + 1,
  );

  const latestCandle = candles.at(-1);

  if (!latestCandle) {
    throw new Error("Support/resistance requires at least one candle");
  }

  const supports: number[] = [];
  const resistances: number[] = [];

  for (
    let index = pivotLookback;
    index < candles.length - pivotLookback;
    index += 1
  ) {
    const candle = candles[index];

    if (!candle) {
      continue;
    }

    const previous = candles.slice(index - pivotLookback, index);
    const next = candles.slice(index + 1, index + pivotLookback + 1);
    const neighbors = [...previous, ...next];

    const isPivotLow =
      neighbors.every((neighbor) => candle.low <= neighbor.low) &&
      neighbors.some((neighbor) => candle.low < neighbor.low);
    const isPivotHigh =
      neighbors.every((neighbor) => candle.high >= neighbor.high) &&
      neighbors.some((neighbor) => candle.high > neighbor.high);

    if (isPivotLow && candle.low < latestCandle.close) {
      supports.push(candle.low);
    }

    if (isPivotHigh && candle.high > latestCandle.close) {
      resistances.push(candle.high);
    }
  }

  const recentCandles = candles.slice(-recentWindow);
  const recentLow = Math.min(...recentCandles.map((candle) => candle.low));
  const recentHigh = Math.max(...recentCandles.map((candle) => candle.high));

  if (recentLow < latestCandle.close) {
    supports.push(recentLow);
  }

  if (recentHigh > latestCandle.close) {
    resistances.push(recentHigh);
  }

  return supportResistanceSnapshotSchema.parse({
    resistance: compactLevels(
      resistances,
      "asc",
      latestCandle.close,
      minDistancePercent,
      maxLevels,
    ),
    support: compactLevels(
      supports,
      "desc",
      latestCandle.close,
      minDistancePercent,
      maxLevels,
    ),
  });
}

function compactLevels(
  levels: number[],
  direction: "asc" | "desc",
  referencePrice: number,
  minDistancePercent: number,
  maxLevels: number,
) {
  const sorted = [...levels].sort((left, right) =>
    direction === "asc" ? left - right : right - left,
  );
  const compacted: number[] = [];

  for (const level of sorted) {
    const isDistinct = compacted.every(
      (existing) =>
        (Math.abs(existing - level) / referencePrice) * 100 >=
        minDistancePercent,
    );

    if (isDistinct) {
      compacted.push(level);
    }

    if (compacted.length === maxLevels) {
      break;
    }
  }

  return compacted;
}
