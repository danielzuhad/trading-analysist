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

export const createPositionInputSchema = z.object({
  userId: idSchema.default("system:default"),
  assetId: idSchema,
  watchlistId: idSchema.optional(),
  sourceAccount: nonEmptyStringSchema.optional(),
  direction: positionDirectionSchema,
  status: positionStatusSchema.default("open"),
  quoteCurrency: currencyCodeSchema.optional(),
  entryPrice: nonNegativeNumberSchema,
  averageEntryPrice: nonNegativeNumberSchema.optional(),
  quantity: positiveNumberSchema,
  remainingQuantity: nonNegativeNumberSchema.optional(),
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
  openedAt: isoDatetimeSchema.optional(),
  metadata: metadataSchema.default({}),
});

export const updatePositionInputSchema = z
  .object({
    sourceAccount: nonEmptyStringSchema.optional(),
    status: positionStatusSchema.optional(),
    quoteCurrency: currencyCodeSchema.optional(),
    averageEntryPrice: nonNegativeNumberSchema.optional(),
    quantity: positiveNumberSchema.optional(),
    remainingQuantity: nonNegativeNumberSchema.optional(),
    notionalValue: nonNegativeNumberSchema.optional(),
    realizedPnl: z.number().finite().optional(),
    unrealizedPnl: z.number().finite().optional(),
    realizedPnlPercent: z.number().finite().optional(),
    unrealizedPnlPercent: z.number().finite().optional(),
    stopLoss: nonNegativeNumberSchema.optional(),
    takeProfitLevels: z.array(takeProfitLevelSchema).optional(),
    thesis: nonEmptyStringSchema.optional(),
    notes: nonEmptyStringSchema.optional(),
    latestState: assetStateSchema.optional(),
    latestSuggestion: positionSuggestionSchema.optional(),
    openedAt: isoDatetimeSchema.optional(),
    closedAt: isoDatetimeSchema.optional(),
    metadata: metadataSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one position field must be provided.",
  });

export const closePositionInputSchema = z.object({
  closedAt: isoDatetimeSchema.optional(),
  realizedPnl: z.number().finite().optional(),
  realizedPnlPercent: z.number().finite().optional(),
  remainingQuantity: nonNegativeNumberSchema.default(0),
  notes: nonEmptyStringSchema.optional(),
  metadata: metadataSchema.optional(),
});

export const positionResponseSchema = z.object({
  position: positionSchema,
});

export const positionsResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  positions: z.array(positionSchema),
});

export type TakeProfitLevel = z.infer<typeof takeProfitLevelSchema>;
export type Position = z.infer<typeof positionSchema>;
export type CreatePositionInput = z.infer<typeof createPositionInputSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionInputSchema>;
export type ClosePositionInput = z.infer<typeof closePositionInputSchema>;
export type PositionResponse = z.infer<typeof positionResponseSchema>;
export type PositionsResponse = z.infer<typeof positionsResponseSchema>;
