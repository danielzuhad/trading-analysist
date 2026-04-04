import {
  type MarketStructure,
  marketStructureSchema,
  type VolatilityRegime,
  volatilityRegimeSchema,
} from "@trading-analyst/shared-types";

type MarketStructureInput = {
  close: number;
  ema20: number;
  ema50: number;
  ema200: number;
};

export function classifyVolatilityRegime(
  currentAtrPercent: number,
  baselineAtrPercent: number,
): VolatilityRegime {
  if (baselineAtrPercent <= 0) {
    return volatilityRegimeSchema.parse("normal");
  }

  const ratio = currentAtrPercent / baselineAtrPercent;

  if (ratio < 0.8) {
    return volatilityRegimeSchema.parse("compressed");
  }

  if (ratio <= 1.2) {
    return volatilityRegimeSchema.parse("normal");
  }

  if (ratio <= 1.6) {
    return volatilityRegimeSchema.parse("expanded");
  }

  return volatilityRegimeSchema.parse("extreme");
}

export function classifyMarketStructure({
  close,
  ema20,
  ema50,
  ema200,
}: MarketStructureInput): MarketStructure {
  if (close > ema20 && ema20 > ema50 && ema50 > ema200) {
    return marketStructureSchema.parse("uptrend");
  }

  if (close < ema20 && ema20 < ema50 && ema50 < ema200) {
    return marketStructureSchema.parse("downtrend");
  }

  const shortSpreadPercent = (Math.abs(ema20 - ema50) / close) * 100;
  const longSpreadPercent = (Math.abs(ema50 - ema200) / close) * 100;

  if (shortSpreadPercent < 0.6 && longSpreadPercent < 1.2) {
    return marketStructureSchema.parse("range");
  }

  return marketStructureSchema.parse("transition");
}
