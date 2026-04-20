import { z } from "zod";
import { assetSchema } from "./asset.js";
import {
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
  nonNegativeNumberSchema,
  percentageScoreSchema,
  stringListSchema,
} from "./common.js";
import { marketContextSnapshotSchema } from "./context.js";
import { indicatorSnapshotSchema } from "./indicator.js";
import { marketSnapshotSchema } from "./market.js";
import { positionSchema } from "./position.js";
import { analysisBiasSchema, marketRegimeSchema } from "./primitives.js";

export const signalLabelSchema = z.object({
  key: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  sentiment: analysisBiasSchema,
  scoreContribution: z.number().int().min(0).max(100),
  details: nonEmptyStringSchema,
});

export const signalKeyLevelsSchema = z.object({
  nearestSupport: nonNegativeNumberSchema.optional(),
  nearestResistance: nonNegativeNumberSchema.optional(),
  invalidation: nonNegativeNumberSchema.optional(),
});

export const signalAggregationSnapshotSchema = z.object({
  id: nonEmptyStringSchema,
  asset: assetSchema,
  marketSnapshot: marketSnapshotSchema,
  indicatorSnapshot: indicatorSnapshotSchema,
  marketContext: marketContextSnapshotSchema.optional(),
  position: positionSchema.optional(),
  generatedAt: isoDatetimeSchema,
  signalStrengthScore: percentageScoreSchema,
  bias: analysisBiasSchema,
  regime: marketRegimeSchema,
  timeframeRelevance: nonEmptyStringSchema,
  riskFlags: stringListSchema,
  keyLevels: signalKeyLevelsSchema,
  labels: z.array(signalLabelSchema).min(1),
  summary: nonEmptyStringSchema,
  snapshotHash: nonEmptyStringSchema,
  metadata: metadataSchema,
});

export type SignalLabel = z.infer<typeof signalLabelSchema>;
export type SignalKeyLevels = z.infer<typeof signalKeyLevelsSchema>;
export type SignalAggregationSnapshot = z.infer<
  typeof signalAggregationSnapshotSchema
>;
