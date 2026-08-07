import { z } from "zod";
import { idSchema, isoDatetimeSchema } from "./common.js";
import { supportedTimeframeSchema } from "./primitives.js";

/**
 * The queue contract between whoever *produces* analysis work and the worker
 * that *consumes* it. This lives in shared-types rather than apps/worker
 * because `apps/api` also enqueues jobs (the Analyze-now button) and apps
 * cannot import each other. Keep it dependency-free — no bullmq here, only
 * the names and payload shape both sides must agree on.
 */
export const analysisQueueName = "analysis";
export const marketSnapshotJobName = "fetch-market-snapshot";
export const outcomeEvaluationJobName = "evaluate-outcomes";
export const thresholdCheckJobName = "check-thresholds";

export const workerJobTriggerValues = [
  "bootstrap",
  "manual",
  "scheduled",
  "threshold",
] as const;
export const workerJobTriggerSchema = z.enum(workerJobTriggerValues);
export type WorkerJobTrigger = z.infer<typeof workerJobTriggerSchema>;

export const marketSnapshotJobDataSchema = z.object({
  assetId: idSchema,
  requestedAt: isoDatetimeSchema,
  timeframe: supportedTimeframeSchema,
  trigger: workerJobTriggerSchema,
  userId: idSchema,
});

export type MarketSnapshotJobData = z.infer<typeof marketSnapshotJobDataSchema>;
