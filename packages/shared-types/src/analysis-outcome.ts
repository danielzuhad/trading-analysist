import { z } from "zod";
import {
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
} from "./common.js";
import {
  analysisBiasSchema,
  analysisSuggestionSchema,
  assetStateSchema,
  supportedTimeframeSchema,
} from "./primitives.js";
import { signalKeyLevelsSchema } from "./signal.js";

export const analysisOutcomeStatusValues = [
  "pending",
  "evaluated",
  "skipped",
] as const;
export const analysisOutcomeStatusSchema = z.enum(analysisOutcomeStatusValues);
export type AnalysisOutcomeStatus = z.infer<typeof analysisOutcomeStatusSchema>;

export const analysisOutcomeEvaluationSchema = z.object({
  evaluatedAt: isoDatetimeSchema,
  priceAtEvaluation: z.number().positive(),
  priceChangePercent: z.number(),
  directionCorrect: z.boolean().nullable(),
  invalidationHit: z.boolean().nullable(),
  candlesCovered: z.number().int().min(0),
});
export type AnalysisOutcomeEvaluation = z.infer<
  typeof analysisOutcomeEvaluationSchema
>;

export const analysisOutcomeSchema = z.object({
  id: nonEmptyStringSchema,
  analysisId: nonEmptyStringSchema,
  assetId: nonEmptyStringSchema,
  timeframe: supportedTimeframeSchema,
  snapshotHash: nonEmptyStringSchema,
  modelUsed: nonEmptyStringSchema,
  promptVersion: nonEmptyStringSchema,
  state: assetStateSchema,
  suggestion: analysisSuggestionSchema,
  bias: analysisBiasSchema,
  signalStrengthScore: z.number().int().min(0).max(100),
  aiConfidence: z.number().int().min(0).max(100),
  keyLevels: signalKeyLevelsSchema,
  priceAtAnalysis: z.number().positive(),
  analysisGeneratedAt: isoDatetimeSchema,
  evaluateAfter: isoDatetimeSchema,
  status: analysisOutcomeStatusSchema,
  evaluation: analysisOutcomeEvaluationSchema.optional(),
  metadata: metadataSchema,
});
export type AnalysisOutcome = z.infer<typeof analysisOutcomeSchema>;

export const analysisQualityBucketSchema = z.object({
  modelUsed: nonEmptyStringSchema,
  promptVersion: nonEmptyStringSchema,
  timeframe: supportedTimeframeSchema,
  state: assetStateSchema,
  evaluatedCount: z.number().int().min(0),
  directionKnownCount: z.number().int().min(0),
  directionCorrectCount: z.number().int().min(0),
  invalidationKnownCount: z.number().int().min(0),
  invalidationHitCount: z.number().int().min(0),
  avgPriceChangePercent: z.number().nullable(),
});
export type AnalysisQualityBucket = z.infer<typeof analysisQualityBucketSchema>;

export const analysisQualityResponseSchema = z.object({
  buckets: z.array(analysisQualityBucketSchema),
  evaluatedCount: z.number().int().min(0),
  pendingCount: z.number().int().min(0),
});
export type AnalysisQualityResponse = z.infer<
  typeof analysisQualityResponseSchema
>;
