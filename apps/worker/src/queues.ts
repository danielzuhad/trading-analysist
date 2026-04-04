import type { SupportedTimeframe } from "@trading-analyst/shared-types";

export const analysisQueueName = "analysis";
export const marketSnapshotJobName = "fetch-market-snapshot";

export type WorkerJobTrigger = "bootstrap" | "manual" | "scheduled";

export type MarketSnapshotJobData = {
  assetId: string;
  requestedAt: string;
  timeframe: SupportedTimeframe;
  trigger: WorkerJobTrigger;
};
