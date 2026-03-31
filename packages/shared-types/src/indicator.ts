import { z } from "zod";
import {
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonNegativeNumberSchema,
} from "./common.js";
import { timeframeSchema, trendDirectionSchema } from "./primitives.js";

export const movingAverageSnapshotSchema = z.object({
  ema20: nonNegativeNumberSchema,
  ema50: nonNegativeNumberSchema,
  ema200: nonNegativeNumberSchema,
});

export const oscillatorSnapshotSchema = z.object({
  rsi14: z.number().finite().min(0).max(100),
});

export const volatilitySnapshotSchema = z.object({
  atr14: nonNegativeNumberSchema,
  atrPercent: nonNegativeNumberSchema.optional(),
  baseline: nonNegativeNumberSchema.optional(),
});

export const volumeSnapshotSchema = z.object({
  current: nonNegativeNumberSchema,
  average20: nonNegativeNumberSchema.optional(),
  relativeVolume: nonNegativeNumberSchema.optional(),
  trend: trendDirectionSchema,
});

export const supportResistanceSnapshotSchema = z.object({
  support: z.array(nonNegativeNumberSchema).default([]),
  resistance: z.array(nonNegativeNumberSchema).default([]),
});

export const indicatorSnapshotSchema = z.object({
  id: idSchema,
  assetId: idSchema,
  timeframe: timeframeSchema,
  calculatedAt: isoDatetimeSchema,
  movingAverages: movingAverageSnapshotSchema,
  oscillators: oscillatorSnapshotSchema,
  volatility: volatilitySnapshotSchema,
  volume: volumeSnapshotSchema,
  levels: supportResistanceSnapshotSchema,
  metadata: metadataSchema,
});

export type MovingAverageSnapshot = z.infer<typeof movingAverageSnapshotSchema>;
export type OscillatorSnapshot = z.infer<typeof oscillatorSnapshotSchema>;
export type VolatilitySnapshot = z.infer<typeof volatilitySnapshotSchema>;
export type VolumeSnapshot = z.infer<typeof volumeSnapshotSchema>;
export type SupportResistanceSnapshot = z.infer<
  typeof supportResistanceSnapshotSchema
>;
export type IndicatorSnapshot = z.infer<typeof indicatorSnapshotSchema>;
