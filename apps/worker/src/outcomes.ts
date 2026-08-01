import {
  completeAnalysisOutcome,
  getLatestMarketData,
  listDueAnalysisOutcomes,
  savePendingAnalysisOutcome,
} from "@trading-analyst/db";
import type {
  AnalysisOutcome,
  AnalysisOutcomeEvaluation,
  LatestAssetAnalysis,
  MarketCandle,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";

type Logger = Pick<typeof console, "error" | "log" | "warn">;

export const defaultOutcomeHorizonHours = 24;

export function buildPendingAnalysisOutcome({
  analysis,
  horizonHours = defaultOutcomeHorizonHours,
}: {
  analysis: LatestAssetAnalysis;
  horizonHours?: number;
}): AnalysisOutcome {
  const generatedAt = new Date(analysis.generatedAt);
  const evaluateAfter = new Date(
    generatedAt.getTime() + horizonHours * 60 * 60 * 1000,
  );
  const timeframe = toSupportedTimeframe(analysis.marketSnapshot.timeframe);

  return {
    id: `outcome:${analysis.asset.id}:${timeframe}:${analysis.snapshotHash}:${analysis.generatedAt}`,
    analysisId: analysis.id,
    assetId: analysis.asset.id,
    timeframe,
    snapshotHash: analysis.snapshotHash,
    modelUsed: analysis.modelUsed,
    promptVersion: analysis.promptVersion,
    state: analysis.state,
    suggestion: analysis.suggestion,
    bias: analysis.bias,
    signalStrengthScore: analysis.signalStrengthScore,
    aiConfidence: analysis.aiConfidence,
    keyLevels: analysis.keyLevels,
    summary: analysis.summary,
    keyReasons: analysis.decisionCard.keyReasons,
    priceAtAnalysis: analysis.marketSnapshot.lastPrice,
    analysisGeneratedAt: analysis.generatedAt,
    evaluateAfter: evaluateAfter.toISOString(),
    status: "pending",
    metadata: {
      horizonHours,
      triggeredBy: analysis.triggeredBy,
    },
  };
}

export function evaluateOutcomeAgainstMarket({
  candles,
  evaluatedAt,
  outcome,
  priceAtEvaluation,
}: {
  candles: MarketCandle[];
  evaluatedAt: string;
  outcome: AnalysisOutcome;
  priceAtEvaluation: number;
}): AnalysisOutcomeEvaluation {
  const generatedAtMs = new Date(outcome.analysisGeneratedAt).getTime();
  const evaluatedAtMs = new Date(evaluatedAt).getTime();
  const windowCandles = candles.filter((candle) => {
    const candleMs = new Date(candle.timestamp).getTime();
    return candleMs > generatedAtMs && candleMs <= evaluatedAtMs;
  });

  const priceChangePercent =
    ((priceAtEvaluation - outcome.priceAtAnalysis) / outcome.priceAtAnalysis) *
    100;

  return {
    candlesCovered: windowCandles.length,
    directionCorrect: resolveDirectionCorrect(outcome.bias, priceChangePercent),
    evaluatedAt,
    invalidationHit: resolveInvalidationHit({
      outcome,
      priceAtEvaluation,
      windowCandles,
    }),
    priceAtEvaluation,
    priceChangePercent,
  };
}

function resolveDirectionCorrect(
  bias: AnalysisOutcome["bias"],
  priceChangePercent: number,
): boolean | null {
  if (bias === "bullish") {
    return priceChangePercent > 0;
  }

  if (bias === "bearish") {
    return priceChangePercent < 0;
  }

  return null;
}

function resolveInvalidationHit({
  outcome,
  priceAtEvaluation,
  windowCandles,
}: {
  outcome: AnalysisOutcome;
  priceAtEvaluation: number;
  windowCandles: MarketCandle[];
}): boolean | null {
  const invalidation = outcome.keyLevels.invalidation;

  if (invalidation === undefined) {
    return null;
  }

  const invalidationIsBelow = invalidation < outcome.priceAtAnalysis;

  if (windowCandles.length === 0) {
    return invalidationIsBelow
      ? priceAtEvaluation <= invalidation
      : priceAtEvaluation >= invalidation;
  }

  if (invalidationIsBelow) {
    const lowestLow = Math.min(...windowCandles.map((candle) => candle.low));
    return lowestLow <= invalidation;
  }

  const highestHigh = Math.max(...windowCandles.map((candle) => candle.high));
  return highestHigh >= invalidation;
}

export type ProcessOutcomeEvaluationJobResult = {
  assetId: string;
  evaluated: number;
  skipped: number;
  status: "completed" | "skipped_no_market_data";
  timeframe: SupportedTimeframe;
};

export async function processOutcomeEvaluationJob({
  assetId,
  completeOutcome = completeAnalysisOutcome,
  connectionString,
  getMarketData = getLatestMarketData,
  listDueOutcomes = listDueAnalysisOutcomes,
  logger = console,
  requestedAt,
  timeframe,
}: {
  assetId: string;
  completeOutcome?: typeof completeAnalysisOutcome;
  connectionString?: string;
  getMarketData?: typeof getLatestMarketData;
  listDueOutcomes?: typeof listDueAnalysisOutcomes;
  logger?: Logger;
  requestedAt: string;
  timeframe: SupportedTimeframe;
}): Promise<ProcessOutcomeEvaluationJobResult> {
  const dueOutcomes = await listDueOutcomes(
    {
      assetId,
      due: new Date(requestedAt),
      timeframe,
    },
    connectionString,
  );

  if (dueOutcomes.length === 0) {
    return {
      assetId,
      evaluated: 0,
      skipped: 0,
      status: "completed",
      timeframe,
    };
  }

  const marketData = await getMarketData(assetId, timeframe, connectionString);

  if (!marketData) {
    logger.warn(
      `[worker] skipped outcome evaluation for ${assetId} ${timeframe} because no market data exists yet`,
    );

    return {
      assetId,
      evaluated: 0,
      skipped: dueOutcomes.length,
      status: "skipped_no_market_data",
      timeframe,
    };
  }

  let evaluated = 0;

  for (const outcome of dueOutcomes) {
    const evaluation = evaluateOutcomeAgainstMarket({
      candles: marketData.series.candles,
      evaluatedAt: requestedAt,
      outcome,
      priceAtEvaluation: marketData.snapshot.lastPrice,
    });

    await completeOutcome(outcome.id, evaluation, connectionString);
    evaluated += 1;
  }

  logger.log(
    `[worker] evaluated ${evaluated} analysis outcome(s) for ${assetId} ${timeframe}`,
  );

  return {
    assetId,
    evaluated,
    skipped: 0,
    status: "completed",
    timeframe,
  };
}

export async function recordPendingAnalysisOutcome({
  analysis,
  connectionString,
  horizonHours,
  logger = console,
  saveOutcome = savePendingAnalysisOutcome,
}: {
  analysis: LatestAssetAnalysis;
  connectionString?: string;
  horizonHours?: number;
  logger?: Logger;
  saveOutcome?: typeof savePendingAnalysisOutcome;
}): Promise<void> {
  try {
    const outcome = buildPendingAnalysisOutcome({
      analysis,
      ...(horizonHours !== undefined ? { horizonHours } : {}),
    });
    const result = await saveOutcome(outcome, connectionString);

    if (result.status === "created") {
      logger.log(
        `[worker] recorded pending analysis outcome ${outcome.id} for evaluation after ${outcome.evaluateAfter}`,
      );
    }
  } catch (error) {
    logger.warn(
      `[worker] failed to record analysis outcome for ${analysis.asset.id}: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

function toSupportedTimeframe(
  timeframe: LatestAssetAnalysis["marketSnapshot"]["timeframe"],
): SupportedTimeframe {
  if (timeframe === "1H" || timeframe === "4H") {
    return timeframe;
  }

  throw new Error(`Unsupported outcome timeframe: ${timeframe}`);
}
