import { z } from "zod";
import {
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
  nonNegativeNumberSchema,
} from "./common.js";
import {
  providerOperationalStatusSchema,
  timeframeSchema,
} from "./primitives.js";

export const marketContextProviderValues = [
  "fear-and-greed",
  "bybit",
  "coingecko",
  "cryptopanic",
] as const;
export const marketContextProviderSchema = z.enum(marketContextProviderValues);
export type MarketContextProvider = z.infer<typeof marketContextProviderSchema>;

export const marketContextProviderStatusSchema = z.object({
  provider: marketContextProviderSchema,
  status: providerOperationalStatusSchema,
  checkedAt: isoDatetimeSchema,
  detail: nonEmptyStringSchema.optional(),
  latencyMs: z.number().int().min(0).optional(),
  metadata: metadataSchema,
});

export const marketSentimentSnapshotSchema = z.object({
  classification: nonEmptyStringSchema,
  value: z.number().int().min(0).max(100),
  valueText: nonEmptyStringSchema.optional(),
});

export const marketDerivativesSnapshotSchema = z.object({
  fundingRate: z.number().finite().optional(),
  fundingRateTimestamp: isoDatetimeSchema.optional(),
  openInterest: nonNegativeNumberSchema.optional(),
  openInterestChangePercent: z.number().finite().optional(),
  openInterestTimestamp: isoDatetimeSchema.optional(),
});

export const marketNewsSnapshotSchema = z.object({
  headlineCount: z.number().int().min(0),
  sentiment: nonEmptyStringSchema.optional(),
  topHeadlines: z.array(nonEmptyStringSchema).default([]),
});

export const marketContextSnapshotSchema = z.object({
  id: idSchema,
  assetId: idSchema,
  timeframe: timeframeSchema,
  generatedAt: isoDatetimeSchema,
  isPartial: z.boolean(),
  missingProviders: z.array(marketContextProviderSchema).default([]),
  providers: z.array(marketContextProviderStatusSchema),
  btcDominancePercent: nonNegativeNumberSchema.optional(),
  totalMarketCapUsd: nonNegativeNumberSchema.optional(),
  totalVolume24hUsd: nonNegativeNumberSchema.optional(),
  totalMarketCapChange24hPercent: z.number().finite().optional(),
  sentiment: marketSentimentSnapshotSchema.optional(),
  derivatives: marketDerivativesSnapshotSchema.optional(),
  news: marketNewsSnapshotSchema.optional(),
  metadata: metadataSchema,
});

export type MarketContextProviderStatus = z.infer<
  typeof marketContextProviderStatusSchema
>;
export type MarketSentimentSnapshot = z.infer<
  typeof marketSentimentSnapshotSchema
>;
export type MarketDerivativesSnapshot = z.infer<
  typeof marketDerivativesSnapshotSchema
>;
export type MarketNewsSnapshot = z.infer<typeof marketNewsSnapshotSchema>;
export type MarketContextSnapshot = z.infer<typeof marketContextSnapshotSchema>;
