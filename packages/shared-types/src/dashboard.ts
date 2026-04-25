import { z } from "zod";
import {
  type LatestAssetAnalysis,
  latestAssetAnalysisSchema,
} from "./analysis.js";
import { assetSchema } from "./asset.js";
import {
  isoDatetimeSchema,
  nonEmptyStringSchema,
  nonNegativeNumberSchema,
  percentageScoreSchema,
  stringListSchema,
} from "./common.js";
import { indicatorSnapshotSchema } from "./indicator.js";
import { marketSnapshotSchema } from "./market.js";
import {
  analysisBiasSchema,
  analysisSuggestionSchema,
  assetStateSchema,
  marketRegimeSchema,
  riskLevelSchema,
  supportedTimeframeSchema,
} from "./primitives.js";
import { signalAggregationSnapshotSchema } from "./signal.js";

export const overviewStatusValues = ["ready", "partial", "pending"] as const;
export const overviewStatusSchema = z.enum(overviewStatusValues);
export type OverviewStatus = z.infer<typeof overviewStatusSchema>;

export const watchlistOverviewItemSchema = z.object({
  asset: assetSchema,
  timeframe: supportedTimeframeSchema,
  status: overviewStatusSchema,
  missingData: stringListSchema,
  marketCapturedAt: isoDatetimeSchema.optional(),
  analysisGeneratedAt: isoDatetimeSchema.optional(),
  provider: nonEmptyStringSchema.optional(),
  lastPrice: nonNegativeNumberSchema.optional(),
  priceChangePercent: z.number().finite().optional(),
  state: assetStateSchema.optional(),
  suggestion: analysisSuggestionSchema.optional(),
  signalStrengthScore: percentageScoreSchema.optional(),
  aiConfidence: percentageScoreSchema.optional(),
  regime: marketRegimeSchema.optional(),
  bias: analysisBiasSchema.optional(),
  riskLevel: riskLevelSchema.optional(),
  summary: nonEmptyStringSchema.optional(),
  keyReasons: stringListSchema,
  concerns: stringListSchema,
  nearestSupport: nonNegativeNumberSchema.optional(),
  nearestResistance: nonNegativeNumberSchema.optional(),
  invalidation: nonNegativeNumberSchema.optional(),
});

export const watchlistOverviewResponseSchema = z.object({
  timeframe: supportedTimeframeSchema,
  generatedAt: isoDatetimeSchema,
  items: z.array(watchlistOverviewItemSchema),
});

export const assetOverviewResponseSchema = z.object({
  asset: assetSchema,
  timeframe: supportedTimeframeSchema,
  generatedAt: isoDatetimeSchema,
  status: overviewStatusSchema,
  missingData: stringListSchema,
  marketSnapshot: marketSnapshotSchema.optional(),
  indicatorSnapshot: indicatorSnapshotSchema.optional(),
  signalSnapshot: signalAggregationSnapshotSchema.optional(),
  analysisSnapshot: latestAssetAnalysisSchema.optional(),
});

export type WatchlistOverviewItem = z.infer<typeof watchlistOverviewItemSchema>;
export type WatchlistOverviewResponse = z.infer<
  typeof watchlistOverviewResponseSchema
>;
export type AssetOverviewResponse = z.infer<typeof assetOverviewResponseSchema>;

export function pickLatestAnalysisRiskLevel(
  analysis: LatestAssetAnalysis | null,
) {
  return analysis?.decisionCard.riskLevel;
}
