import {
  type IndicatorSnapshot,
  indicatorSnapshotSchema,
  type MarketCandleSeries,
} from "@trading-analyst/shared-types";
import {
  calculateAtrPercent,
  calculateAverageTrueRange,
  calculateAverageTrueRangeSeries,
} from "./atr.js";
import {
  classifyMarketStructure,
  classifyVolatilityRegime,
} from "./classification.js";
import { calculateExponentialMovingAverage } from "./ema.js";
import {
  findSupportResistanceLevels,
  type SupportResistanceOptions,
} from "./levels.js";
import { average, lastValue, requireDefined } from "./math.js";
import { calculateRelativeStrengthIndex } from "./rsi.js";
import { buildVolumeSnapshot } from "./volume.js";

export type BuildIndicatorSnapshotOptions = {
  atrPeriod?: number;
  levelOptions?: SupportResistanceOptions;
  marketSeries: MarketCandleSeries;
  volumeLookback?: number;
};

export function buildIndicatorSnapshot({
  atrPeriod = 14,
  levelOptions,
  marketSeries,
  volumeLookback = 20,
}: BuildIndicatorSnapshotOptions): IndicatorSnapshot {
  const closes = marketSeries.candles.map((candle) => candle.close);
  const latestClose = lastValue(closes, "Close series");
  const ema20 = calculateExponentialMovingAverage(closes, 20);
  const ema50 = calculateExponentialMovingAverage(closes, 50);
  const ema200 = calculateExponentialMovingAverage(closes, 200);
  const rsi14 = calculateRelativeStrengthIndex(closes, 14);
  const atr14 = calculateAverageTrueRange(marketSeries.candles, atrPeriod);
  const atrSeries = calculateAverageTrueRangeSeries(
    marketSeries.candles,
    atrPeriod,
  );
  const atrPercent = calculateAtrPercent(atr14, latestClose);
  const atrPercentHistory = atrSeries.map((atr, index) =>
    calculateAtrPercent(
      atr,
      requireDefined(
        marketSeries.candles[atrPeriod + index],
        "ATR history candle",
      ).close,
    ),
  );
  const baselineWindow = atrPercentHistory.slice(-21, -1);
  const atrBaseline =
    baselineWindow.length > 0 ? average(baselineWindow) : atrPercent;
  const volatilityRegime = classifyVolatilityRegime(atrPercent, atrBaseline);
  const volume = buildVolumeSnapshot(marketSeries.candles, volumeLookback);
  const levels = findSupportResistanceLevels(
    marketSeries.candles,
    levelOptions,
  );
  const structure = classifyMarketStructure({
    close: latestClose,
    ema20,
    ema50,
    ema200,
  });

  return indicatorSnapshotSchema.parse({
    assetId: marketSeries.assetId,
    calculatedAt: marketSeries.capturedAt,
    id: `indicator:${marketSeries.assetId}:${marketSeries.timeframe}`,
    levels,
    metadata: {
      atrPeriod,
      candleCount: marketSeries.candles.length,
      sourceCapturedAt: marketSeries.capturedAt,
      sourceProvider: marketSeries.provider,
      volumeLookback,
    },
    movingAverages: {
      ema20,
      ema50,
      ema200,
    },
    oscillators: {
      rsi14,
    },
    structure,
    timeframe: marketSeries.timeframe,
    volatility: {
      atr14,
      atrPercent,
      baseline: atrBaseline,
      regime: volatilityRegime,
    },
    volume,
  });
}
