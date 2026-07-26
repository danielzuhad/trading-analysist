import { z } from "zod";
import { assetSchema } from "./asset.js";
import { isoDatetimeSchema, nonEmptyStringSchema } from "./common.js";
import { positionDirectionSchema } from "./primitives.js";

export const portfolioConcentrationWarningSchema = z.object({
  kind: z.enum(["direction_concentration", "single_asset_concentration"]),
  message: nonEmptyStringSchema,
  exposurePercent: z.number().finite().min(0).max(100),
});

export const portfolioPositionSummarySchema = z.object({
  asset: assetSchema,
  positionId: nonEmptyStringSchema,
  direction: positionDirectionSchema,
  notionalValue: z.number().finite().min(0),
  unrealizedPnl: z.number().finite().optional(),
  unrealizedPnlPercent: z.number().finite().optional(),
  exposurePercent: z.number().finite().min(0).max(100),
});

export const portfolioOverviewResponseSchema = z.object({
  generatedAt: isoDatetimeSchema,
  openPositionCount: z.number().int().nonnegative(),
  totalNotionalValue: z.number().finite().min(0),
  totalUnrealizedPnl: z.number().finite(),
  longExposurePercent: z.number().finite().min(0).max(100),
  shortExposurePercent: z.number().finite().min(0).max(100),
  positions: z.array(portfolioPositionSummarySchema),
  concentrationWarnings: z.array(portfolioConcentrationWarningSchema),
});

export type PortfolioConcentrationWarning = z.infer<
  typeof portfolioConcentrationWarningSchema
>;
export type PortfolioPositionSummary = z.infer<
  typeof portfolioPositionSummarySchema
>;
export type PortfolioOverviewResponse = z.infer<
  typeof portfolioOverviewResponseSchema
>;
