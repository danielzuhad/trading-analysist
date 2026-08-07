/**
 * The queue contract now lives in shared-types so `apps/api` can enqueue work
 * too (apps cannot import each other). Re-exported here because the rest of
 * the worker already refers to these names through `./queues.js`.
 */
export type {
  MarketSnapshotJobData,
  WorkerJobTrigger,
} from "@trading-analyst/shared-types";
export {
  analysisQueueName,
  marketSnapshotJobDataSchema,
  marketSnapshotJobName,
  outcomeEvaluationJobName,
  thresholdCheckJobName,
} from "@trading-analyst/shared-types";
