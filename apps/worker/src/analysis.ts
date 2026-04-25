import {
  type AiAnalysisProvider,
  analyzeSignalSnapshot,
  createOpenAiAnalysisProvider,
  defaultAiAnalysisModel,
  defaultAiAnalysisPromptVersion,
} from "@trading-analyst/ai-analysis";
import { generateStateTransitionAlert } from "@trading-analyst/alert-engine";
import {
  getDailyAiCostTotalUsd,
  getLatestAssetAnalysis,
  getLatestSignalAggregationSnapshot,
  saveAlert,
  saveLatestAssetAnalysis,
} from "@trading-analyst/db";
import type {
  AnalysisTrigger,
  AssetState,
  LatestAssetAnalysis,
  SignalAggregationSnapshot,
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
  generateAlert?: typeof generateStateTransitionAlert;
  logger?: Logger;
  maxDailyAiCostUsd?: number;
  model?: string;
  openAiApiKey?: string;
  promptVersion?: string;
  provider?: AiAnalysisProvider;
  saveGeneratedAlert?: typeof saveAlert;
  saveAnalysis?: typeof saveLatestAssetAnalysis;
  timeframe: SupportedTimeframe;
  triggeredBy?: AnalysisTrigger;
};

type GenerateAssetAnalysisFromSignalSnapshotOptions = Omit<
  GenerateLatestAssetAnalysisOptions,
  "assetId" | "getLatestSignalSnapshot"
> & {
  signalSnapshot: SignalAggregationSnapshot;
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
  generateAlert = generateStateTransitionAlert,
  logger = console,
  maxDailyAiCostUsd,
  model = defaultAiAnalysisModel,
  openAiApiKey,
  promptVersion = defaultAiAnalysisPromptVersion,
  provider,
  saveGeneratedAlert = saveAlert,
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
  await generateAndPersistAlert({
    connectionString,
    currentAnalysis: result.analysis,
    generateAlert,
    logger,
    previousAnalysis,
    saveGeneratedAlert,
  });
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

export async function generateAssetAnalysisFromSignalSnapshot({
  connectionString,
  currentDailyCostUsd,
  day = new Date(),
  getCurrentDailyAiCostUsd = getDailyAiCostTotalUsd,
  getLatestAnalysis = getLatestAssetAnalysis,
  generateAlert = generateStateTransitionAlert,
  logger = console,
  maxDailyAiCostUsd,
  model = defaultAiAnalysisModel,
  openAiApiKey,
  promptVersion = defaultAiAnalysisPromptVersion,
  provider,
  saveGeneratedAlert = saveAlert,
  saveAnalysis = saveLatestAssetAnalysis,
  signalSnapshot,
  triggeredBy = "manual_recalculation",
}: GenerateAssetAnalysisFromSignalSnapshotOptions): Promise<GenerateLatestAssetAnalysisResult> {
  const timeframe = toSupportedTimeframe(
    signalSnapshot.marketSnapshot.timeframe,
  );

  if (!provider && !openAiApiKey) {
    logger.warn(
      `[worker] skipped AI analysis for ${signalSnapshot.asset.id} ${signalSnapshot.marketSnapshot.timeframe} because OPENAI_API_KEY is not configured`,
    );

    return {
      assetId: signalSnapshot.asset.id,
      reason: "missing_openai_api_key",
      status: "skipped",
      timeframe,
    };
  }

  const previousAnalysis = await getLatestAnalysis(
    signalSnapshot.asset.id,
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
      `[worker] skipped AI analysis for ${signalSnapshot.asset.id} ${signalSnapshot.marketSnapshot.timeframe} because the daily AI cost cap has been reached`,
    );

    return {
      assetId: signalSnapshot.asset.id,
      reason: "daily_cost_cap_reached",
      status: "skipped",
      timeframe,
    };
  }

  await saveAnalysis(result.analysis, connectionString);
  await generateAndPersistAlert({
    connectionString,
    currentAnalysis: result.analysis,
    generateAlert,
    logger,
    previousAnalysis,
    saveGeneratedAlert,
  });
  logger.log(
    `[worker] stored AI analysis ${result.analysis.id} for ${signalSnapshot.asset.id} ${signalSnapshot.marketSnapshot.timeframe} in state ${result.analysis.state}`,
  );

  return {
    analysisId: result.analysis.id,
    assetId: signalSnapshot.asset.id,
    state: result.analysis.state,
    status: "stored",
    timeframe,
  };
}

async function generateAndPersistAlert({
  connectionString,
  currentAnalysis,
  generateAlert,
  logger,
  previousAnalysis,
  saveGeneratedAlert,
}: {
  connectionString: string | undefined;
  currentAnalysis: LatestAssetAnalysis;
  generateAlert: typeof generateStateTransitionAlert;
  logger: Logger;
  previousAnalysis: LatestAssetAnalysis | null;
  saveGeneratedAlert: typeof saveAlert;
}) {
  const alertResult = generateAlert({
    currentAnalysis,
    previousAnalysis,
  });

  if (alertResult.status === "skipped") {
    logger.log(
      `[worker] skipped alert generation for ${currentAnalysis.asset.id} ${currentAnalysis.marketSnapshot.timeframe}: ${alertResult.reason}`,
    );
    return;
  }

  const saveResult = await saveGeneratedAlert(
    alertResult.alert,
    connectionString,
  );

  logger.log(
    `[worker] ${saveResult.status === "created" ? "created" : "deduplicated"} alert ${alertResult.alert.id} for ${currentAnalysis.asset.id} ${currentAnalysis.marketSnapshot.timeframe}`,
  );
}

function toSupportedTimeframe(
  timeframe: SignalAggregationSnapshot["marketSnapshot"]["timeframe"],
): SupportedTimeframe {
  if (timeframe === "1H" || timeframe === "4H") {
    return timeframe;
  }

  throw new Error(`Unsupported analysis timeframe: ${timeframe}`);
}
