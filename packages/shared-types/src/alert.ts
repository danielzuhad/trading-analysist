import { z } from "zod";
import {
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
} from "./common.js";
import {
  alertKindSchema,
  alertSeveritySchema,
  alertStatusSchema,
  analysisSuggestionSchema,
  assetStateSchema,
  notificationChannelSchema,
  supportedTimeframeSchema,
} from "./primitives.js";

export const alertSchema = z.object({
  id: idSchema,
  userId: idSchema,
  assetId: idSchema,
  watchlistId: idSchema.optional(),
  positionId: idSchema.optional(),
  analysisId: idSchema.optional(),
  transitionId: idSchema.optional(),
  timeframe: supportedTimeframeSchema,
  dedupeKey: nonEmptyStringSchema,
  kind: alertKindSchema,
  severity: alertSeveritySchema,
  status: alertStatusSchema,
  channels: z.array(notificationChannelSchema).min(1),
  title: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  previousState: assetStateSchema.optional(),
  currentState: assetStateSchema,
  suggestion: analysisSuggestionSchema.optional(),
  createdAt: isoDatetimeSchema,
  deliveredAt: isoDatetimeSchema.optional(),
  acknowledgedAt: isoDatetimeSchema.optional(),
  expiresAt: isoDatetimeSchema.optional(),
  isStale: z.boolean(),
  metadata: metadataSchema,
});

export const alertsResponseSchema = z.object({
  alerts: z.array(alertSchema),
  count: z.number().int().min(0),
});

export type Alert = z.infer<typeof alertSchema>;
export type AlertsResponse = z.infer<typeof alertsResponseSchema>;
