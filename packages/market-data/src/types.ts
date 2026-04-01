import {
  type Asset,
  assetSchema,
  isoDatetimeSchema,
  type MarketCandleSeries,
  type MarketSnapshot,
  marketCandleSeriesSchema,
  marketSnapshotSchema,
  nonEmptyStringSchema,
  type SupportedTimeframe,
  supportedTimeframeSchema,
} from "@trading-analyst/shared-types";
import { z } from "zod";

export const marketDataRequestSchema = z.object({
  asset: assetSchema,
  candleLimit: z.number().int().min(2).max(1_000).default(250),
  provider: nonEmptyStringSchema.optional(),
  requestedAt: isoDatetimeSchema.optional(),
  timeframe: supportedTimeframeSchema,
});

export type MarketDataRequest = z.input<typeof marketDataRequestSchema>;

export type ValidatedMarketDataRequest = {
  asset: Asset;
  candleLimit: number;
  provider?: string;
  requestedAt: string;
  timeframe: SupportedTimeframe;
};

export type MarketDataResult = {
  series: MarketCandleSeries;
  snapshot: MarketSnapshot;
};

export type MarketDataAdapter = {
  readonly provider: string;
  fetchSeries: (
    request: ValidatedMarketDataRequest,
  ) => Promise<MarketCandleSeries>;
};

export const marketDataResultSchema = z.object({
  series: marketCandleSeriesSchema,
  snapshot: marketSnapshotSchema,
});
