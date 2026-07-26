import {
  type AiAnalysisProvider,
  analyzeSignalSnapshot,
  createOpenAiAnalysisProvider,
  defaultAiAnalysisModel,
  defaultAiAnalysisPromptVersion,
} from "@trading-analyst/ai-analysis";
import { generateStateTransitionAlert } from "@trading-analyst/alert-engine";
import {
  formatAlertDeliveryMessage,
  sendTelegramMessage,
  sendTwilioMessage,
} from "@trading-analyst/chat-layer";
import {
  getDailyAiCostTotalUsdForUser,
  getLatestAssetAnalysis,
  getLatestSignalAggregationSnapshot,
  markAlertDelivered,
  recordAiCost,
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
import { recordPendingAnalysisOutcome } from "./outcomes.js";

type Logger = Pick<typeof console, "error" | "log" | "warn">;

type WhatsappAlertDelivery = {
  accountSid: string;
  authToken: string;
  from: string;
  statusCallbackUrl?: string;
  to: string;
};

type TelegramAlertDelivery = {
  botToken: string;
  chatId: string;
};

type GenerateLatestAssetAnalysisOptions = {
  assetId: string;
  connectionString?: string;
  currentDailyCostUsd?: number;
  day?: Date;
  getCurrentDailyAiCostUsd?: typeof getDailyAiCostTotalUsdForUser;
  getLatestAnalysis?: typeof getLatestAssetAnalysis;
  getLatestSignalSnapshot?: typeof getLatestSignalAggregationSnapshot;
  generateAlert?: typeof generateStateTransitionAlert;
  logger?: Logger;
  maxDailyAiCostUsd?: number;
  model?: string;
  openAiApiKey?: string;
  promptVersion?: string;
  provider?: AiAnalysisProvider;
  markDeliveredAlert?: typeof markAlertDelivered;
  recordAiCostFn?: typeof recordAiCost;
  recordOutcome?: typeof recordPendingAnalysisOutcome;
  saveGeneratedAlert?: typeof saveAlert;
  saveAnalysis?: typeof saveLatestAssetAnalysis;
  sendTelegramMessageFn?: typeof sendTelegramMessage;
  sendWhatsappMessage?: typeof sendTwilioMessage;
  telegramAlertDelivery?: TelegramAlertDelivery;
  timeframe: SupportedTimeframe;
  triggeredBy?: AnalysisTrigger;
  userId: string;
  whatsappAlertDelivery?: WhatsappAlertDelivery;
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
        | "signal_snapshot_not_found"
        | "snapshot_unchanged";
      status: "skipped";
      timeframe: SupportedTimeframe;
    };

export async function generateLatestAssetAnalysis({
  assetId,
  connectionString,
  currentDailyCostUsd,
  day = new Date(),
  getCurrentDailyAiCostUsd = getDailyAiCostTotalUsdForUser,
  getLatestAnalysis = getLatestAssetAnalysis,
  getLatestSignalSnapshot = getLatestSignalAggregationSnapshot,
  generateAlert = generateStateTransitionAlert,
  logger = console,
  maxDailyAiCostUsd,
  model = defaultAiAnalysisModel,
  openAiApiKey,
  promptVersion = defaultAiAnalysisPromptVersion,
  provider,
  markDeliveredAlert = markAlertDelivered,
  recordAiCostFn = recordAiCost,
  recordOutcome = recordPendingAnalysisOutcome,
  saveGeneratedAlert = saveAlert,
  saveAnalysis = saveLatestAssetAnalysis,
  sendTelegramMessageFn = sendTelegramMessage,
  sendWhatsappMessage = sendTwilioMessage,
  telegramAlertDelivery,
  timeframe,
  triggeredBy = "manual_recalculation",
  userId,
  whatsappAlertDelivery,
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

  if (
    triggeredBy === "scheduled" &&
    previousAnalysis &&
    isAnalysisInputUnchanged(previousAnalysis, signalSnapshot)
  ) {
    logger.log(
      `[worker] skipped AI analysis for ${assetId} ${timeframe} because market conditions are unchanged since the last analysis`,
    );

    return {
      assetId,
      reason: "snapshot_unchanged",
      status: "skipped",
      timeframe,
    };
  }

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
    (await getCurrentDailyAiCostUsd(userId, day, connectionString));
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
  await recordAiCostFn(
    {
      analysisId: result.analysis.id,
      assetId,
      costEstimateUsd: result.analysis.costEstimateUsd,
      generatedAt: result.analysis.generatedAt,
      timeframe,
      userId,
    },
    connectionString,
  );
  await recordOutcome({
    analysis: result.analysis,
    ...(connectionString ? { connectionString } : {}),
    logger,
  });
  await generateAndPersistAlert({
    connectionString,
    currentAnalysis: result.analysis,
    generateAlert,
    logger,
    markDeliveredAlert,
    previousAnalysis,
    saveGeneratedAlert,
    sendTelegramMessageFn,
    sendWhatsappMessage,
    ...(telegramAlertDelivery ? { telegramAlertDelivery } : {}),
    ...(whatsappAlertDelivery ? { whatsappAlertDelivery } : {}),
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
  getCurrentDailyAiCostUsd = getDailyAiCostTotalUsdForUser,
  getLatestAnalysis = getLatestAssetAnalysis,
  generateAlert = generateStateTransitionAlert,
  logger = console,
  maxDailyAiCostUsd,
  model = defaultAiAnalysisModel,
  openAiApiKey,
  promptVersion = defaultAiAnalysisPromptVersion,
  provider,
  markDeliveredAlert = markAlertDelivered,
  recordAiCostFn = recordAiCost,
  recordOutcome = recordPendingAnalysisOutcome,
  saveGeneratedAlert = saveAlert,
  saveAnalysis = saveLatestAssetAnalysis,
  sendTelegramMessageFn = sendTelegramMessage,
  sendWhatsappMessage = sendTwilioMessage,
  signalSnapshot,
  telegramAlertDelivery,
  triggeredBy = "manual_recalculation",
  userId,
  whatsappAlertDelivery,
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

  if (
    triggeredBy === "scheduled" &&
    previousAnalysis &&
    isAnalysisInputUnchanged(previousAnalysis, signalSnapshot)
  ) {
    logger.log(
      `[worker] skipped AI analysis for ${signalSnapshot.asset.id} ${timeframe} because market conditions are unchanged since the last analysis`,
    );

    return {
      assetId: signalSnapshot.asset.id,
      reason: "snapshot_unchanged",
      status: "skipped",
      timeframe,
    };
  }

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
    (await getCurrentDailyAiCostUsd(userId, day, connectionString));
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
  await recordAiCostFn(
    {
      analysisId: result.analysis.id,
      assetId: signalSnapshot.asset.id,
      costEstimateUsd: result.analysis.costEstimateUsd,
      generatedAt: result.analysis.generatedAt,
      timeframe,
      userId,
    },
    connectionString,
  );
  await recordOutcome({
    analysis: result.analysis,
    ...(connectionString ? { connectionString } : {}),
    logger,
  });
  await generateAndPersistAlert({
    connectionString,
    currentAnalysis: result.analysis,
    generateAlert,
    logger,
    markDeliveredAlert,
    previousAnalysis,
    saveGeneratedAlert,
    sendTelegramMessageFn,
    sendWhatsappMessage,
    ...(telegramAlertDelivery ? { telegramAlertDelivery } : {}),
    ...(whatsappAlertDelivery ? { whatsappAlertDelivery } : {}),
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
  markDeliveredAlert,
  previousAnalysis,
  saveGeneratedAlert,
  sendTelegramMessageFn,
  sendWhatsappMessage,
  telegramAlertDelivery,
  whatsappAlertDelivery,
}: {
  connectionString: string | undefined;
  currentAnalysis: LatestAssetAnalysis;
  generateAlert: typeof generateStateTransitionAlert;
  logger: Logger;
  markDeliveredAlert: typeof markAlertDelivered;
  previousAnalysis: LatestAssetAnalysis | null;
  saveGeneratedAlert: typeof saveAlert;
  sendTelegramMessageFn: typeof sendTelegramMessage;
  sendWhatsappMessage: typeof sendTwilioMessage;
  telegramAlertDelivery?: TelegramAlertDelivery | undefined;
  whatsappAlertDelivery?: WhatsappAlertDelivery | undefined;
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

  if (saveResult.status !== "created") {
    return;
  }

  if (
    telegramAlertDelivery &&
    alertResult.alert.channels.includes("telegram")
  ) {
    try {
      const telegramResult = await sendTelegramMessageFn({
        botToken: telegramAlertDelivery.botToken,
        chatId: telegramAlertDelivery.chatId,
        text: formatAlertDeliveryMessage(alertResult.alert),
      });

      await markDeliveredAlert(
        alertResult.alert.id,
        {
          metadata: {
            chatLayerChannel: "telegram",
            chatLayerMessageId: String(telegramResult.messageId),
            chatLayerProvider: "telegram",
            chatLayerRecipient: String(telegramResult.chatId),
            chatLayerStatus: telegramResult.status,
          },
        },
        connectionString,
      );
      logger.log(
        `[worker] delivered alert ${alertResult.alert.id} to Telegram chat ${telegramResult.chatId}`,
      );
    } catch (error) {
      logger.error(
        `[worker] failed Telegram delivery for alert ${alertResult.alert.id}: ${formatDeliveryError(error)}`,
      );
    }
  }

  if (!whatsappAlertDelivery) {
    return;
  }

  if (!alertResult.alert.channels.includes("whatsapp")) {
    return;
  }

  try {
    const deliveryResult = await sendWhatsappMessage({
      accountSid: whatsappAlertDelivery.accountSid,
      authToken: whatsappAlertDelivery.authToken,
      body: formatAlertDeliveryMessage(alertResult.alert),
      from: whatsappAlertDelivery.from,
      ...(whatsappAlertDelivery.statusCallbackUrl
        ? { statusCallbackUrl: whatsappAlertDelivery.statusCallbackUrl }
        : {}),
      to: whatsappAlertDelivery.to,
    });

    await markDeliveredAlert(
      alertResult.alert.id,
      {
        metadata: {
          chatLayerChannel: "whatsapp",
          chatLayerMessageSid: deliveryResult.sid,
          chatLayerProvider: "twilio",
          chatLayerRecipient: deliveryResult.to,
          chatLayerStatus: deliveryResult.status,
        },
      },
      connectionString,
    );
    logger.log(
      `[worker] delivered alert ${alertResult.alert.id} to WhatsApp recipient ${deliveryResult.to}`,
    );
  } catch (error) {
    logger.error(
      `[worker] failed WhatsApp delivery for alert ${alertResult.alert.id}: ${formatDeliveryError(error)}`,
    );
  }
}

const unchangedPriceTolerancePercent = 0.5;

export function isAnalysisInputUnchanged(
  previous: LatestAssetAnalysis,
  snapshot: SignalAggregationSnapshot,
): boolean {
  if (previous.signalStrengthScore !== snapshot.signalStrengthScore) {
    return false;
  }

  if (previous.bias !== snapshot.bias || previous.regime !== snapshot.regime) {
    return false;
  }

  if (
    previous.keyLevels.nearestSupport !== snapshot.keyLevels.nearestSupport ||
    previous.keyLevels.nearestResistance !==
      snapshot.keyLevels.nearestResistance ||
    previous.keyLevels.invalidation !== snapshot.keyLevels.invalidation
  ) {
    return false;
  }

  if ((previous.position?.id ?? null) !== (snapshot.position?.id ?? null)) {
    return false;
  }

  const previousPrice = previous.marketSnapshot.lastPrice;

  if (previousPrice <= 0) {
    return false;
  }

  const priceChangePercent = Math.abs(
    ((snapshot.marketSnapshot.lastPrice - previousPrice) / previousPrice) * 100,
  );

  return priceChangePercent < unchangedPriceTolerancePercent;
}

function toSupportedTimeframe(
  timeframe: SignalAggregationSnapshot["marketSnapshot"]["timeframe"],
): SupportedTimeframe {
  if (timeframe === "1H" || timeframe === "4H") {
    return timeframe;
  }

  throw new Error(`Unsupported analysis timeframe: ${timeframe}`);
}

function formatDeliveryError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
