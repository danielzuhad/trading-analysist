import { z } from "zod";
import {
  currencyCodeSchema,
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
  nonNegativeNumberSchema,
  positiveNumberSchema,
  stringListSchema,
} from "./common.js";
import { marketSessionSchema, timeframeSchema } from "./primitives.js";

export const ohlcvCandleSchema = z.object({
  open: nonNegativeNumberSchema,
  high: nonNegativeNumberSchema,
  low: nonNegativeNumberSchema,
  close: nonNegativeNumberSchema,
  volume: nonNegativeNumberSchema,
});

export const marketSnapshotSchema = z.object({
  id: idSchema,
  assetId: idSchema,
  provider: nonEmptyStringSchema,
  timeframe: timeframeSchema,
  capturedAt: isoDatetimeSchema,
  lastPrice: nonNegativeNumberSchema,
  bidPrice: nonNegativeNumberSchema.optional(),
  askPrice: nonNegativeNumberSchema.optional(),
  candle: ohlcvCandleSchema,
  marketSession: marketSessionSchema,
  priceChangePercent: z.number().finite().optional(),
  volumeWeightedAveragePrice: nonNegativeNumberSchema.optional(),
  quoteCurrency: currencyCodeSchema.optional(),
  baseCurrency: currencyCodeSchema.optional(),
  eventFlags: stringListSchema,
  metadata: metadataSchema,
});

export const marketFetchRequestSchema = z.object({
  assetId: idSchema,
  provider: nonEmptyStringSchema,
  timeframe: timeframeSchema,
  requestedAt: isoDatetimeSchema,
});

export const marketPricePointSchema = z.object({
  timestamp: isoDatetimeSchema,
  price: positiveNumberSchema,
});

export type OhlcvCandle = z.infer<typeof ohlcvCandleSchema>;
export type MarketSnapshot = z.infer<typeof marketSnapshotSchema>;
export type MarketFetchRequest = z.infer<typeof marketFetchRequestSchema>;
export type MarketPricePoint = z.infer<typeof marketPricePointSchema>;
