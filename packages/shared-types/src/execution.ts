import { z } from "zod";
import {
  currencyCodeSchema,
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
  nonNegativeNumberSchema,
} from "./common.js";
import { takeProfitLevelSchema } from "./position.js";
import {
  executionActionTypeSchema,
  executionSourceSchema,
  notificationChannelSchema,
} from "./primitives.js";

export const executionRecordSchema = z.object({
  id: idSchema,
  userId: idSchema,
  assetId: idSchema,
  positionId: idSchema.optional(),
  relatedAlertId: idSchema.optional(),
  actionType: executionActionTypeSchema,
  source: executionSourceSchema,
  channel: notificationChannelSchema.optional(),
  sourceAccount: nonEmptyStringSchema.optional(),
  executionPrice: nonNegativeNumberSchema.optional(),
  quantity: nonNegativeNumberSchema.optional(),
  notionalValue: nonNegativeNumberSchema.optional(),
  feesPaid: nonNegativeNumberSchema.optional(),
  feeCurrency: currencyCodeSchema.optional(),
  stopLoss: nonNegativeNumberSchema.optional(),
  takeProfitLevels: z.array(takeProfitLevelSchema).default([]),
  note: nonEmptyStringSchema.optional(),
  executedAt: isoDatetimeSchema,
  recordedAt: isoDatetimeSchema,
  isManual: z.boolean(),
  metadata: metadataSchema,
});

export type ExecutionRecord = z.infer<typeof executionRecordSchema>;
