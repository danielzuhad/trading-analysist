import type {
  AiAnalysisEngineOutput,
  AnalysisTrigger,
  AssetState,
  LatestAssetAnalysis,
  SignalAggregationSnapshot,
} from "@trading-analyst/shared-types";
import {
  latestAssetAnalysisSchema,
  positionSuggestionValues,
  watchlistSuggestionValues,
} from "@trading-analyst/shared-types";

export const defaultAiAnalysisModel = "gpt-4o-mini";
export const defaultAiAnalysisPromptVersion = "ai-analysis:v1";
export const defaultMaxDailyAiCostUsd = 2;

const criticalAssetStates = new Set<AssetState>([
  "PREPARE",
  "ACTIONABLE",
  "IN_POSITION",
  "EXIT_WARNING",
]);

type AiModelPricing = {
  cachedInputUsdPerMillion: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const gpt4oMiniPricing: AiModelPricing = {
  inputUsdPerMillion: 0.15,
  cachedInputUsdPerMillion: 0.075,
  outputUsdPerMillion: 0.6,
};

const gpt4oPricing: AiModelPricing = {
  inputUsdPerMillion: 2.5,
  cachedInputUsdPerMillion: 1.25,
  outputUsdPerMillion: 10,
};

export type AiAnalysisProviderResult = {
  aiLatencyMs: number;
  metadata?: Record<string, unknown>;
  modelUsed: string;
  output: AiAnalysisEngineOutput;
  usage: {
    cachedInputTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
};

export type AiAnalysisProvider = (options: {
  model: string;
  promptVersion: string;
  signalSnapshot: SignalAggregationSnapshot;
}) => Promise<AiAnalysisProviderResult>;

export type AiConfidenceClampResult = {
  aiConfidence: number;
  maxAllowed: number;
  minAllowed: number;
  originalAiConfidence?: number;
  wasClamped: boolean;
};

export type AiCostCapDecision = {
  maxDailyCostUsd: number;
  reason?: "daily_cost_cap_reached";
  shouldSkip: boolean;
};

export type AnalyzeSignalSnapshotResult =
  | {
      analysis: LatestAssetAnalysis;
      status: "analyzed";
    }
  | {
      currentDailyCostUsd: number;
      maxDailyCostUsd: number;
      reason: "daily_cost_cap_reached";
      status: "skipped";
    };

type BuildLatestAssetAnalysisOptions = {
  aiLatencyMs: number;
  aiOutput: AiAnalysisEngineOutput;
  costEstimateUsd: number;
  generatedAt?: string;
  metadata?: Record<string, unknown>;
  modelUsed: string;
  promptVersion?: string;
  signalSnapshot: SignalAggregationSnapshot;
  triggeredBy?: AnalysisTrigger;
};

type AnalyzeSignalSnapshotOptions = {
  currentDailyCostUsd?: number;
  generatedAt?: string;
  maxDailyCostUsd?: number;
  model?: string;
  previousState?: AssetState;
  promptVersion?: string;
  provider: AiAnalysisProvider;
  signalSnapshot: SignalAggregationSnapshot;
  triggeredBy?: AnalysisTrigger;
};

export function getAiConfidenceBounds(signalStrengthScore: number) {
  return {
    minAllowed: Math.max(0, signalStrengthScore - 20),
    maxAllowed: Math.min(100, signalStrengthScore + 20),
  };
}

export function clampAiConfidence(
  aiConfidence: number,
  signalStrengthScore: number,
): AiConfidenceClampResult {
  const { maxAllowed, minAllowed } = getAiConfidenceBounds(signalStrengthScore);
  const clamped = Math.min(maxAllowed, Math.max(minAllowed, aiConfidence));
  const wasClamped = clamped !== aiConfidence;

  return {
    aiConfidence: clamped,
    maxAllowed,
    minAllowed,
    ...(wasClamped ? { originalAiConfidence: aiConfidence } : {}),
    wasClamped,
  };
}

export function parseMaxDailyAiCostUsd(value?: number | string) {
  if (value === undefined) {
    return defaultMaxDailyAiCostUsd;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid MAX_DAILY_AI_COST_USD value: ${value}`);
  }

  return parsed;
}

export function shouldSkipAiAnalysisForDailyCostCap({
  currentDailyCostUsd = 0,
  maxDailyCostUsd = defaultMaxDailyAiCostUsd,
  previousState,
}: {
  currentDailyCostUsd?: number;
  maxDailyCostUsd?: number;
  previousState?: AssetState;
}): AiCostCapDecision {
  const normalizedCap = parseMaxDailyAiCostUsd(maxDailyCostUsd);

  if (currentDailyCostUsd < normalizedCap) {
    return {
      maxDailyCostUsd: normalizedCap,
      shouldSkip: false,
    };
  }

  if (previousState && criticalAssetStates.has(previousState)) {
    return {
      maxDailyCostUsd: normalizedCap,
      shouldSkip: false,
    };
  }

  return {
    maxDailyCostUsd: normalizedCap,
    reason: "daily_cost_cap_reached",
    shouldSkip: true,
  };
}

export function estimateAiCostUsd({
  cachedInputTokens = 0,
  inputTokens,
  model,
  outputTokens,
}: {
  cachedInputTokens?: number;
  inputTokens: number;
  model: string;
  outputTokens: number;
}) {
  const pricing = resolveModelPricing(model);
  const normalizedCachedTokens = Math.max(
    0,
    Math.min(cachedInputTokens, inputTokens),
  );
  const uncachedInputTokens = Math.max(0, inputTokens - normalizedCachedTokens);
  const inputCost =
    (uncachedInputTokens * pricing.inputUsdPerMillion) / 1_000_000;
  const cachedInputCost =
    (normalizedCachedTokens * pricing.cachedInputUsdPerMillion) / 1_000_000;
  const outputCost = (outputTokens * pricing.outputUsdPerMillion) / 1_000_000;

  return roundUsd(inputCost + cachedInputCost + outputCost);
}

export function resolveAllowedSuggestionValues(
  signalSnapshot: SignalAggregationSnapshot,
) {
  return signalSnapshot.position
    ? [...positionSuggestionValues]
    : [...watchlistSuggestionValues];
}

export function buildAiAnalysisPrompt({
  promptVersion = defaultAiAnalysisPromptVersion,
  signalSnapshot,
}: {
  promptVersion?: string;
  signalSnapshot: SignalAggregationSnapshot;
}) {
  const { maxAllowed, minAllowed } = getAiConfidenceBounds(
    signalSnapshot.signalStrengthScore,
  );
  const allowedSuggestions = resolveAllowedSuggestionValues(signalSnapshot);
  const positionMode = signalSnapshot.position
    ? "There is an active position. Use only position-management suggestions."
    : "There is no active position. Use only watchlist-entry suggestions.";

  return {
    promptVersion,
    system: [
      "You are the AI analysis engine for a manual crypto trading assistant.",
      "You are the analyst. Do not ask follow-up questions.",
      "Use only the provided snapshot. Do not invent external news, order flow, or price action.",
      "Be decisive but conservative when evidence is mixed.",
      `aiConfidence MUST be between ${minAllowed} and ${maxAllowed}.`,
      positionMode,
      `Allowed suggestions: ${allowedSuggestions.join(", ")}.`,
      "Return only the requested structured JSON.",
    ].join(" "),
    user: JSON.stringify(
      {
        instruction:
          "Analyze this snapshot and return the best state, suggestion, confidence, reasons, concerns, action plan, execution method, invalidation, risk level, and notes.",
        signalSnapshot,
      },
      null,
      2,
    ),
  };
}

export async function analyzeSignalSnapshot({
  currentDailyCostUsd = 0,
  generatedAt,
  maxDailyCostUsd = defaultMaxDailyAiCostUsd,
  model = defaultAiAnalysisModel,
  previousState,
  promptVersion = defaultAiAnalysisPromptVersion,
  provider,
  signalSnapshot,
  triggeredBy = "manual_recalculation",
}: AnalyzeSignalSnapshotOptions): Promise<AnalyzeSignalSnapshotResult> {
  const capDecision = shouldSkipAiAnalysisForDailyCostCap({
    currentDailyCostUsd,
    maxDailyCostUsd,
    ...(previousState ? { previousState } : {}),
  });

  if (capDecision.shouldSkip) {
    return {
      currentDailyCostUsd,
      maxDailyCostUsd: capDecision.maxDailyCostUsd,
      reason: "daily_cost_cap_reached",
      status: "skipped",
    };
  }

  const providerResult = await provider({
    model,
    promptVersion,
    signalSnapshot,
  });
  const costEstimateUsd = estimateAiCostUsd({
    cachedInputTokens: providerResult.usage.cachedInputTokens,
    inputTokens: providerResult.usage.inputTokens,
    model: providerResult.modelUsed,
    outputTokens: providerResult.usage.outputTokens,
  });

  return {
    analysis: buildLatestAssetAnalysis({
      aiLatencyMs: providerResult.aiLatencyMs,
      aiOutput: providerResult.output,
      costEstimateUsd,
      ...(generatedAt ? { generatedAt } : {}),
      ...(providerResult.metadata ? { metadata: providerResult.metadata } : {}),
      modelUsed: providerResult.modelUsed,
      promptVersion,
      signalSnapshot,
      triggeredBy,
    }),
    status: "analyzed",
  };
}

export function buildLatestAssetAnalysis({
  aiLatencyMs,
  aiOutput,
  costEstimateUsd,
  generatedAt = new Date().toISOString(),
  metadata,
  modelUsed,
  promptVersion = defaultAiAnalysisPromptVersion,
  signalSnapshot,
  triggeredBy = "manual_recalculation",
}: BuildLatestAssetAnalysisOptions): LatestAssetAnalysis {
  const confidence = clampAiConfidence(
    aiOutput.aiConfidence,
    signalSnapshot.signalStrengthScore,
  );

  return latestAssetAnalysisSchema.parse({
    id: buildLatestAssetAnalysisId(
      signalSnapshot.asset.id,
      signalSnapshot.marketSnapshot.timeframe,
    ),
    asset: signalSnapshot.asset,
    marketSnapshot: signalSnapshot.marketSnapshot,
    indicatorSnapshot: signalSnapshot.indicatorSnapshot,
    ...(signalSnapshot.position ? { position: signalSnapshot.position } : {}),
    state: aiOutput.state,
    suggestion: aiOutput.suggestion,
    summary: aiOutput.summary,
    decisionCard: {
      summary: aiOutput.summary,
      keyReasons: aiOutput.keyReasons,
      actionPlan: aiOutput.actionPlan,
      executionMethod: aiOutput.executionMethod,
      invalidation: aiOutput.invalidation,
      riskLevel: aiOutput.riskLevel,
    },
    regime: signalSnapshot.regime,
    bias: signalSnapshot.bias,
    signalStrengthScore: signalSnapshot.signalStrengthScore,
    aiConfidence: confidence.aiConfidence,
    ...(confidence.originalAiConfidence !== undefined
      ? { originalAiConfidence: confidence.originalAiConfidence }
      : {}),
    concerns: aiOutput.concerns,
    suggestedPositionSize: aiOutput.suggestedPositionSize,
    timeframeRelevance: signalSnapshot.timeframeRelevance,
    riskFlags: signalSnapshot.riskFlags,
    keyLevels: signalSnapshot.keyLevels,
    modelUsed,
    promptVersion,
    snapshotHash: signalSnapshot.snapshotHash,
    aiLatencyMs,
    costEstimateUsd,
    generatedAt,
    triggeredBy,
    ...(aiOutput.notes ? { notes: aiOutput.notes } : {}),
    metadata: {
      aiAnalysisVersion: promptVersion,
      signalAggregationSnapshotId: signalSnapshot.id,
      ...(confidence.wasClamped
        ? {
            aiConfidenceClampRange: {
              maxAllowed: confidence.maxAllowed,
              minAllowed: confidence.minAllowed,
            },
          }
        : {}),
      ...(metadata ?? {}),
    },
  });
}

export function buildLatestAssetAnalysisId(
  assetId: string,
  timeframe: SignalAggregationSnapshot["marketSnapshot"]["timeframe"],
) {
  return `analysis:latest:${assetId}:${timeframe}`;
}

function resolveModelPricing(model: string): AiModelPricing {
  if (model.startsWith("gpt-4o-mini")) {
    return gpt4oMiniPricing;
  }

  if (model.startsWith("gpt-4o")) {
    return gpt4oPricing;
  }

  throw new Error(`Unsupported AI pricing model: ${model}`);
}

function roundUsd(value: number) {
  return Number(value.toFixed(8));
}
