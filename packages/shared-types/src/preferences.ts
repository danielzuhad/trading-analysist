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
  supportedTimeframeSchema,
  tradingStyleSchema,
} from "./primitives.js";

export const userPreferenceSchema = z.object({
  id: idSchema,
  userId: idSchema,
  defaultTradingStyle: tradingStyleSchema,
  defaultRiskProfile: riskProfileSchema,
  preferredTimeframes: z.array(supportedTimeframeSchema).min(1),
  timezone: nonEmptyStringSchema,
  locale: nonEmptyStringSchema,
  notificationChannels: z.array(notificationChannelSchema).min(1),
  alertCooldownMinutes: z.number().int().min(0),
  receiveOnlyPositionAlerts: z.boolean(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  metadata: metadataSchema,
});

export type UserPreference = z.infer<typeof userPreferenceSchema>;
