import { z } from "zod";
import { assetSchema } from "./asset.js";
import {
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
  nonNegativeNumberSchema,
  percentageScoreSchema,
  stringListSchema,
} from "./common.js";
import { decisionCardSchema } from "./decision-card.js";
import { indicatorSnapshotSchema } from "./indicator.js";
import { marketSnapshotSchema } from "./market.js";
import { positionSchema } from "./position.js";
import {
  analysisBiasSchema,
  analysisSuggestionSchema,
  analysisTriggerSchema,
  assetStateSchema,
  marketRegimeSchema,
} from "./primitives.js";

export const keyLevelSchema = z.object({
  entry: nonNegativeNumberSchema.optional(),
  stopLoss: nonNegativeNumberSchema.optional(),
  takeProfitLevels: z.array(nonNegativeNumberSchema).default([]),
});

export const assetAnalysisSchema = z.object({
  id: idSchema,
  userId: idSchema,
  watchlistId: idSchema.optional(),
  asset: assetSchema,
  marketSnapshot: marketSnapshotSchema,
  indicatorSnapshot: indicatorSnapshotSchema,
  position: positionSchema.optional(),
  state: assetStateSchema,
  previousState: assetStateSchema.optional(),
  suggestion: analysisSuggestionSchema,
  decisionCard: decisionCardSchema,
  regime: marketRegimeSchema,
  bias: analysisBiasSchema,
  setupQualityScore: percentageScoreSchema,
  confidenceScore: percentageScoreSchema,
  riskFlags: stringListSchema,
  keyLevels: keyLevelSchema,
  generatedAt: isoDatetimeSchema,
  triggeredBy: analysisTriggerSchema,
  notes: nonEmptyStringSchema.optional(),
  metadata: metadataSchema,
});

export const assetStateTransitionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  assetId: idSchema,
  analysisId: idSchema.optional(),
  positionId: idSchema.optional(),
  fromState: assetStateSchema,
  toState: assetStateSchema,
  changedAt: isoDatetimeSchema,
  triggeredBy: analysisTriggerSchema,
  reason: nonEmptyStringSchema,
  metadata: metadataSchema,
});

export type KeyLevel = z.infer<typeof keyLevelSchema>;
export type AssetAnalysis = z.infer<typeof assetAnalysisSchema>;
export type AssetStateTransition = z.infer<typeof assetStateTransitionSchema>;
