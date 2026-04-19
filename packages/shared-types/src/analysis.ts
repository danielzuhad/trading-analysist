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
  riskLevelSchema,
  suggestedPositionSizeSchema,
} from "./primitives.js";
import { signalKeyLevelsSchema } from "./signal.js";

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
  signalStrengthScore: percentageScoreSchema,
  aiConfidence: percentageScoreSchema,
  originalAiConfidence: percentageScoreSchema.optional(),
  concerns: stringListSchema,
  suggestedPositionSize: suggestedPositionSizeSchema,
  timeframeRelevance: nonEmptyStringSchema,
  riskFlags: stringListSchema,
  keyLevels: keyLevelSchema,
  modelUsed: nonEmptyStringSchema,
  promptVersion: nonEmptyStringSchema,
  snapshotHash: nonEmptyStringSchema,
  aiLatencyMs: z.number().int().min(0),
  costEstimateUsd: nonNegativeNumberSchema,
  generatedAt: isoDatetimeSchema,
  triggeredBy: analysisTriggerSchema,
  notes: nonEmptyStringSchema.optional(),
  metadata: metadataSchema,
});

export const aiAnalysisEngineOutputSchema = z.object({
  state: assetStateSchema,
  suggestion: analysisSuggestionSchema,
  summary: nonEmptyStringSchema,
  keyReasons: z.array(nonEmptyStringSchema).min(1),
  concerns: stringListSchema,
  actionPlan: z.array(nonEmptyStringSchema).min(1),
  executionMethod: nonEmptyStringSchema,
  invalidation: nonEmptyStringSchema,
  riskLevel: riskLevelSchema,
  suggestedPositionSize: suggestedPositionSizeSchema,
  aiConfidence: percentageScoreSchema,
  notes: nonEmptyStringSchema.optional(),
});

export const latestAssetAnalysisSchema = z.object({
  id: idSchema,
  asset: assetSchema,
  marketSnapshot: marketSnapshotSchema,
  indicatorSnapshot: indicatorSnapshotSchema,
  position: positionSchema.optional(),
  state: assetStateSchema,
  suggestion: analysisSuggestionSchema,
  summary: nonEmptyStringSchema,
  decisionCard: decisionCardSchema,
  regime: marketRegimeSchema,
  bias: analysisBiasSchema,
  signalStrengthScore: percentageScoreSchema,
  aiConfidence: percentageScoreSchema,
  originalAiConfidence: percentageScoreSchema.optional(),
  concerns: stringListSchema,
  suggestedPositionSize: suggestedPositionSizeSchema,
  timeframeRelevance: nonEmptyStringSchema,
  riskFlags: stringListSchema,
  keyLevels: signalKeyLevelsSchema,
  modelUsed: nonEmptyStringSchema,
  promptVersion: nonEmptyStringSchema,
  snapshotHash: nonEmptyStringSchema,
  aiLatencyMs: z.number().int().min(0),
  costEstimateUsd: nonNegativeNumberSchema,
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
export type AiAnalysisEngineOutput = z.infer<
  typeof aiAnalysisEngineOutputSchema
>;
export type AssetAnalysis = z.infer<typeof assetAnalysisSchema>;
export type AssetStateTransition = z.infer<typeof assetStateTransitionSchema>;
export type LatestAssetAnalysis = z.infer<typeof latestAssetAnalysisSchema>;
