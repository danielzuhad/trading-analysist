import {
  type MarketCandle,
  type MarketCandleSeries,
  marketCandleSeriesSchema,
} from "@trading-analyst/shared-types";

export function buildCandlesFromCloses(
  closes: number[],
  volumeFactory: (index: number) => number = () => 100,
): MarketCandle[] {
  return closes.map((close, index) => {
    const previousClose = closes[index - 1] ?? close;
    const open = Number(previousClose.toFixed(2));
    const normalizedClose = Number(close.toFixed(2));

    return {
      close: normalizedClose,
      high: Number((Math.max(open, normalizedClose) + 1).toFixed(2)),
      low: Number((Math.min(open, normalizedClose) - 1).toFixed(2)),
      open,
      timestamp: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
      volume: volumeFactory(index),
    };
  });
}

export function createOscillatingUptrendSeries(
  length = 240,
): MarketCandleSeries {
  const closes = Array.from(
    { length },
    (_, index) => 100 + index * 0.75 + Math.sin(index / 6) * 2.5,
  );
  const candles = buildCandlesFromCloses(
    closes,
    (index) => 1_200 + index * 12 + Math.round((Math.sin(index / 4) + 1) * 80),
  );
  const latestCandle = candles.at(-1);

  if (!latestCandle) {
    throw new Error("Expected the generated series to include candles.");
  }

  return marketCandleSeriesSchema.parse({
    assetId: "crypto:global:BTC-USD",
    candles,
    capturedAt: latestCandle.timestamp,
    eventFlags: [],
    lastPrice: latestCandle.close,
    marketSession: "continuous",
    metadata: {},
    provider: "indicator-fixture",
    timeframe: "1H",
  });
}
