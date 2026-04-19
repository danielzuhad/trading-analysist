import {
  type AiAnalysisProvider,
  analyzeSignalSnapshot,
  createOpenAiAnalysisProvider,
  defaultAiAnalysisModel,
  defaultAiAnalysisPromptVersion,
} from "@trading-analyst/ai-analysis";
import {
  getDailyAiCostTotalUsd,
  getLatestAssetAnalysis,
  getLatestSignalAggregationSnapshot,
  saveLatestAssetAnalysis,
} from "@trading-analyst/db";
import type {
  AnalysisTrigger,
  AssetState,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";

type Logger = Pick<typeof console, "error" | "log" | "warn">;

type GenerateLatestAssetAnalysisOptions = {
  assetId: string;
  connectionString?: string;
  currentDailyCostUsd?: number;
  day?: Date;
  getCurrentDailyAiCostUsd?: typeof getDailyAiCostTotalUsd;
  getLatestAnalysis?: typeof getLatestAssetAnalysis;
  getLatestSignalSnapshot?: typeof getLatestSignalAggregationSnapshot;
  logger?: Logger;
  maxDailyAiCostUsd?: number;
  model?: string;
  openAiApiKey?: string;
  promptVersion?: string;
  provider?: AiAnalysisProvider;
  saveAnalysis?: typeof saveLatestAssetAnalysis;
  timeframe: SupportedTimeframe;
  triggeredBy?: AnalysisTrigger;
};

export type GenerateLatestAssetAnalysisResult =
  | {
      analysisId: string;
      assetId: string;
      state: AssetState;
      status: "stored";
      timeframe: SupportedTimeframe;
    }
  | {
      assetId: string;
      reason:
        | "daily_cost_cap_reached"
        | "missing_openai_api_key"
        | "signal_snapshot_not_found";
      status: "skipped";
      timeframe: SupportedTimeframe;
    };

export async function generateLatestAssetAnalysis({
  assetId,
  connectionString,
  currentDailyCostUsd,
  day = new Date(),
  getCurrentDailyAiCostUsd = getDailyAiCostTotalUsd,
  getLatestAnalysis = getLatestAssetAnalysis,
  getLatestSignalSnapshot = getLatestSignalAggregationSnapshot,
  logger = console,
  maxDailyAiCostUsd,
  model = defaultAiAnalysisModel,
  openAiApiKey,
  promptVersion = defaultAiAnalysisPromptVersion,
  provider,
  saveAnalysis = saveLatestAssetAnalysis,
  timeframe,
  triggeredBy = "manual_recalculation",
}: GenerateLatestAssetAnalysisOptions): Promise<GenerateLatestAssetAnalysisResult> {
  const signalSnapshot = await getLatestSignalSnapshot(
    assetId,
    timeframe,
    connectionString,
  );

  if (!signalSnapshot) {
    logger.warn(
      `[worker] skipped AI analysis for ${assetId} ${timeframe} because no signal snapshot exists`,
    );

    return {
      assetId,
      reason: "signal_snapshot_not_found",
      status: "skipped",
      timeframe,
    };
  }

  if (!provider && !openAiApiKey) {
    logger.warn(
      `[worker] skipped AI analysis for ${assetId} ${timeframe} because OPENAI_API_KEY is not configured`,
    );

    return {
      assetId,
      reason: "missing_openai_api_key",
      status: "skipped",
      timeframe,
    };
  }

  const previousAnalysis = await getLatestAnalysis(
    assetId,
    timeframe,
    connectionString,
  );
  let providerToUse = provider;

  if (!providerToUse) {
    if (!openAiApiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when no AI provider is supplied.",
      );
    }

    providerToUse = createOpenAiAnalysisProvider({ apiKey: openAiApiKey });
  }
  const dailyCostTotal =
    currentDailyCostUsd ??
    (await getCurrentDailyAiCostUsd(day, connectionString));
  const result = await analyzeSignalSnapshot({
    currentDailyCostUsd: dailyCostTotal,
    ...(maxDailyAiCostUsd !== undefined
      ? { maxDailyCostUsd: maxDailyAiCostUsd }
      : {}),
    model,
    ...(previousAnalysis?.state
      ? { previousState: previousAnalysis.state }
      : {}),
    promptVersion,
    provider: providerToUse,
    signalSnapshot,
    triggeredBy,
  });

  if (result.status === "skipped") {
    logger.warn(
      `[worker] skipped AI analysis for ${assetId} ${timeframe} because the daily AI cost cap has been reached`,
    );

    return {
      assetId,
      reason: "daily_cost_cap_reached",
      status: "skipped",
      timeframe,
    };
  }

  await saveAnalysis(result.analysis, connectionString);
  logger.log(
    `[worker] stored AI analysis ${result.analysis.id} for ${assetId} ${timeframe} in state ${result.analysis.state}`,
  );

  return {
    analysisId: result.analysis.id,
    assetId,
    state: result.analysis.state,
    status: "stored",
    timeframe,
  };
}
