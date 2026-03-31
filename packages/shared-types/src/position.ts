import { z } from "zod";
import {
  currencyCodeSchema,
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
  nonNegativeNumberSchema,
  percentageScoreSchema,
  positiveNumberSchema,
} from "./common.js";
import {
  assetStateSchema,
  positionDirectionSchema,
  positionStatusSchema,
  positionSuggestionSchema,
} from "./primitives.js";

export const takeProfitLevelSchema = z.object({
  price: nonNegativeNumberSchema,
  percentageToClose: percentageScoreSchema.optional(),
  label: nonEmptyStringSchema.optional(),
});

export const positionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  assetId: idSchema,
  watchlistId: idSchema.optional(),
  sourceAccount: nonEmptyStringSchema.optional(),
  direction: positionDirectionSchema,
  status: positionStatusSchema,
  quoteCurrency: currencyCodeSchema.optional(),
  entryPrice: nonNegativeNumberSchema,
  averageEntryPrice: nonNegativeNumberSchema,
  quantity: positiveNumberSchema,
  remainingQuantity: nonNegativeNumberSchema,
  notionalValue: nonNegativeNumberSchema.optional(),
  realizedPnl: z.number().finite().optional(),
  unrealizedPnl: z.number().finite().optional(),
  realizedPnlPercent: z.number().finite().optional(),
  unrealizedPnlPercent: z.number().finite().optional(),
  stopLoss: nonNegativeNumberSchema.optional(),
  takeProfitLevels: z.array(takeProfitLevelSchema).default([]),
  thesis: nonEmptyStringSchema.optional(),
  notes: nonEmptyStringSchema.optional(),
  latestState: assetStateSchema.optional(),
  latestSuggestion: positionSuggestionSchema.optional(),
  openedAt: isoDatetimeSchema,
  closedAt: isoDatetimeSchema.optional(),
  lastUpdatedAt: isoDatetimeSchema,
  isBackfilled: z.boolean(),
  metadata: metadataSchema,
});

export type TakeProfitLevel = z.infer<typeof takeProfitLevelSchema>;
export type Position = z.infer<typeof positionSchema>;
