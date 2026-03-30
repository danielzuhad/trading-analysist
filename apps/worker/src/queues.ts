export const analysisQueueName = "analysis";

export type AnalysisJobData = {
  requestedAt: string;
  trigger: "bootstrap" | "manual";
};
