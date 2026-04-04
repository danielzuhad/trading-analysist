import {
  type MarketCandle,
  type VolumeSnapshot,
  volumeSnapshotSchema,
} from "@trading-analyst/shared-types";
import { assertMinimumLength, assertPositiveInteger, average } from "./math.js";

export function buildVolumeSnapshot(
  candles: MarketCandle[],
  lookback = 20,
): VolumeSnapshot {
  assertPositiveInteger("Volume lookback", lookback);
  assertMinimumLength("Volume snapshot", candles.length, lookback + 1);

  const latestCandle = candles.at(-1);

  if (!latestCandle) {
    throw new Error("Volume snapshot requires at least one candle");
  }

  const baselineVolumes = candles
    .slice(-(lookback + 1), -1)
    .map((candle) => candle.volume);
  const average20 = average(baselineVolumes);
  const relativeVolume = average20 === 0 ? 0 : latestCandle.volume / average20;
  const trailingFiveAverage = average(
    candles.slice(-5).map((candle) => candle.volume),
  );
  const previousFiveAverage = average(
    candles.slice(-10, -5).map((candle) => candle.volume),
  );

  let trend: VolumeSnapshot["trend"] = "mixed";

  if (
    relativeVolume >= 1.2 &&
    trailingFiveAverage >= previousFiveAverage * 1.05
  ) {
    trend = "up";
  } else if (
    relativeVolume <= 0.8 &&
    trailingFiveAverage <= previousFiveAverage * 0.95
  ) {
    trend = "down";
  } else if (Math.abs(relativeVolume - 1) <= 0.1) {
    trend = "flat";
  }

  return volumeSnapshotSchema.parse({
    average20,
    current: latestCandle.volume,
    relativeVolume,
    trend,
  });
}
