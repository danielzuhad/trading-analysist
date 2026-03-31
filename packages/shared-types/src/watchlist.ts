import { z } from "zod";
import {
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
} from "./common.js";
import {
  notificationChannelSchema,
  riskProfileSchema,
  timeframeSchema,
  tradingStyleSchema,
  watchlistStatusSchema,
} from "./primitives.js";

export const userWatchlistSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: nonEmptyStringSchema,
  description: nonEmptyStringSchema.optional(),
  assetIds: z.array(idSchema),
  priorityAssetIds: z.array(idSchema).default([]),
  mutedAssetIds: z.array(idSchema).default([]),
  tradingStyle: tradingStyleSchema,
  riskProfile: riskProfileSchema,
  timeframes: z.array(timeframeSchema).min(1),
  notificationChannels: z.array(notificationChannelSchema).min(1),
  status: watchlistStatusSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  metadata: metadataSchema,
});

export type UserWatchlist = z.infer<typeof userWatchlistSchema>;
