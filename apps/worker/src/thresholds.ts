import {
  getLatestAssetAnalysis,
  getLatestSignalAggregationSnapshot,
} from "@trading-analyst/db";
import {
  type CoinGeckoApiPlan,
  fetchCoinGeckoCurrentPrice,
} from "@trading-analyst/market-data";
import type {
  LatestAssetAnalysis,
  SignalAggregationSnapshot,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";
import { findDefaultCryptoAsset } from "./market-data.js";

type ThresholdReferenceSnapshot =
  | {
      generatedAt: string;
      indicatorSnapshot: LatestAssetAnalysis["indicatorSnapshot"];
      keyLevels: LatestAssetAnalysis["keyLevels"];
      marketSnapshot: LatestAssetAnalysis["marketSnapshot"];
      source: "analysis";
    }
  | {
      generatedAt: string;
      indicatorSnapshot: SignalAggregationSnapshot["indicatorSnapshot"];
      keyLevels: SignalAggregationSnapshot["keyLevels"];
      marketSnapshot: SignalAggregationSnapshot["marketSnapshot"];
      source: "signal";
    };

type ThresholdLevelKind = "invalidation" | "resistance" | "support";

export type ThresholdLevelHit = {
  distance: number;
  kind: ThresholdLevelKind;
  level: number;
};

export type EvaluateThresholdApproachResult =
  | {
      currentPrice: number;
      level: ThresholdLevelHit;
      status: "triggered";
      thresholdDistance: number;
    }
  | {
      currentPrice: number;
      level?: ThresholdLevelHit;
      reason:
        | "cooldown_active"
        | "levels_not_available"
        | "threshold_not_reached";
      status: "skipped";
      thresholdDistance: number;
    };

export type ProcessThresholdCheckJobResult =
  | {
      assetId: string;
      currentPrice: number;
      level: ThresholdLevelHit;
      referenceSource: ThresholdReferenceSnapshot["source"];
      status: "triggered";
      thresholdDistance: number;
      timeframe: SupportedTimeframe;
    }
  | {
      assetId: string;
      currentPrice?: number;
      level?: ThresholdLevelHit;
      reason:
        | "asset_not_supported"
        | "cooldown_active"
        | "levels_not_available"
        | "missing_api_key"
        | "snapshot_not_found"
        | "threshold_not_reached";
      referenceSource?: ThresholdReferenceSnapshot["source"];
      status: "skipped";
      thresholdDistance?: number;
      timeframe: SupportedTimeframe;
    };

type ProcessThresholdCheckJobOptions = {
  apiKey?: string;
  apiPlan?: CoinGeckoApiPlan;
  assetId: string;
  connectionString?: string;
  fetchCurrentPrice?: typeof fetchCoinGeckoCurrentPrice;
  getLatestAnalysis?: typeof getLatestAssetAnalysis;
  getLatestSignalSnapshot?: typeof getLatestSignalAggregationSnapshot;
  requestedAt: string;
  timeframe: SupportedTimeframe;
};

export function evaluateThresholdApproach({
  atr14,
  currentPrice,
  keyLevels,
  requestedAt,
  snapshotGeneratedAt,
  timeframe,
}: {
  atr14: number;
  currentPrice: number;
  keyLevels: ThresholdReferenceSnapshot["keyLevels"];
  requestedAt: string;
  snapshotGeneratedAt: string;
  timeframe: SupportedTimeframe;
}): EvaluateThresholdApproachResult {
  const thresholdDistance = Math.max(0, Number(atr14.toFixed(8)));
  const levels = collectThresholdLevels(keyLevels, currentPrice);

  if (levels.length === 0) {
    return {
      currentPrice,
      reason: "levels_not_available",
      status: "skipped",
      thresholdDistance,
    };
  }

  const nearestLevel = levels[0];

  if (!nearestLevel || nearestLevel.distance > thresholdDistance) {
    return {
      currentPrice,
      ...(nearestLevel ? { level: nearestLevel } : {}),
      reason: "threshold_not_reached",
      status: "skipped",
      thresholdDistance,
    };
  }

  const cooldownMs = getThresholdReanalysisCooldownMs(timeframe);
  const snapshotAgeMs = Math.max(
    0,
    Date.parse(requestedAt) - Date.parse(snapshotGeneratedAt),
  );

  if (snapshotAgeMs < cooldownMs) {
    return {
      currentPrice,
      level: nearestLevel,
      reason: "cooldown_active",
      status: "skipped",
      thresholdDistance,
    };
  }

  return {
    currentPrice,
    level: nearestLevel,
    status: "triggered",
    thresholdDistance,
  };
}

export async function processThresholdCheckJob({
  apiKey,
  apiPlan = "demo",
  assetId,
  connectionString,
  fetchCurrentPrice = fetchCoinGeckoCurrentPrice,
  getLatestAnalysis = getLatestAssetAnalysis,
  getLatestSignalSnapshot = getLatestSignalAggregationSnapshot,
  requestedAt,
  timeframe,
}: ProcessThresholdCheckJobOptions): Promise<ProcessThresholdCheckJobResult> {
  const asset = findDefaultCryptoAsset(assetId);

  if (!asset) {
    return {
      assetId,
      reason: "asset_not_supported",
      status: "skipped",
      timeframe,
    };
  }

  if (!apiKey) {
    return {
      assetId,
      reason: "missing_api_key",
      status: "skipped",
      timeframe,
    };
  }

  const [latestAnalysis, latestSignalSnapshot] = await Promise.all([
    getLatestAnalysis(assetId, timeframe, connectionString),
    getLatestSignalSnapshot(assetId, timeframe, connectionString),
  ]);
  const referenceSnapshot = selectThresholdReferenceSnapshot(
    latestAnalysis,
    latestSignalSnapshot,
  );

  if (!referenceSnapshot) {
    return {
      assetId,
      reason: "snapshot_not_found",
      status: "skipped",
      timeframe,
    };
  }

  const currentPrice = await fetchCurrentPrice({
    apiKey,
    apiPlan,
    asset,
  });
  const evaluation = evaluateThresholdApproach({
    atr14: referenceSnapshot.indicatorSnapshot.volatility.atr14,
    currentPrice: currentPrice.price,
    keyLevels: referenceSnapshot.keyLevels,
    requestedAt,
    snapshotGeneratedAt: referenceSnapshot.generatedAt,
    timeframe,
  });

  if (evaluation.status === "skipped") {
    return {
      assetId,
      currentPrice: evaluation.currentPrice,
      reason: evaluation.reason,
      status: "skipped",
      timeframe,
      ...(evaluation.level ? { level: evaluation.level } : {}),
      referenceSource: referenceSnapshot.source,
      thresholdDistance: evaluation.thresholdDistance,
    };
  }

  return {
    assetId,
    currentPrice: evaluation.currentPrice,
    level: evaluation.level,
    referenceSource: referenceSnapshot.source,
    status: "triggered",
    thresholdDistance: evaluation.thresholdDistance,
    timeframe,
  };
}

export function getThresholdReanalysisCooldownMs(
  timeframe: SupportedTimeframe,
) {
  return timeframe === "1H" ? 15 * 60 * 1000 : 60 * 60 * 1000;
}

function collectThresholdLevels(
  keyLevels: ThresholdReferenceSnapshot["keyLevels"],
  currentPrice: number,
): ThresholdLevelHit[] {
  const levels = [
    keyLevels.invalidation !== undefined
      ? {
          distance: roundLevelDistance(
            Math.abs(currentPrice - keyLevels.invalidation),
          ),
          kind: "invalidation" as const,
          level: keyLevels.invalidation,
        }
      : undefined,
    keyLevels.nearestResistance !== undefined
      ? {
          distance: roundLevelDistance(
            Math.abs(currentPrice - keyLevels.nearestResistance),
          ),
          kind: "resistance" as const,
          level: keyLevels.nearestResistance,
        }
      : undefined,
    keyLevels.nearestSupport !== undefined
      ? {
          distance: roundLevelDistance(
            Math.abs(currentPrice - keyLevels.nearestSupport),
          ),
          kind: "support" as const,
          level: keyLevels.nearestSupport,
        }
      : undefined,
  ].filter((level): level is ThresholdLevelHit => level !== undefined);

  levels.sort((left, right) => left.distance - right.distance);

  return levels;
}

function roundLevelDistance(value: number) {
  return Number(value.toFixed(8));
}

function selectThresholdReferenceSnapshot(
  latestAnalysis: LatestAssetAnalysis | null,
  latestSignalSnapshot: SignalAggregationSnapshot | null,
): ThresholdReferenceSnapshot | null {
  if (!latestAnalysis && !latestSignalSnapshot) {
    return null;
  }

  if (!latestAnalysis && latestSignalSnapshot) {
    return {
      generatedAt: latestSignalSnapshot.generatedAt,
      indicatorSnapshot: latestSignalSnapshot.indicatorSnapshot,
      keyLevels: latestSignalSnapshot.keyLevels,
      marketSnapshot: latestSignalSnapshot.marketSnapshot,
      source: "signal",
    };
  }

  if (latestAnalysis && !latestSignalSnapshot) {
    return {
      generatedAt: latestAnalysis.generatedAt,
      indicatorSnapshot: latestAnalysis.indicatorSnapshot,
      keyLevels: latestAnalysis.keyLevels,
      marketSnapshot: latestAnalysis.marketSnapshot,
      source: "analysis",
    };
  }

  if (
    latestSignalSnapshot &&
    latestAnalysis &&
    Date.parse(latestSignalSnapshot.generatedAt) >
      Date.parse(latestAnalysis.generatedAt)
  ) {
    return {
      generatedAt: latestSignalSnapshot.generatedAt,
      indicatorSnapshot: latestSignalSnapshot.indicatorSnapshot,
      keyLevels: latestSignalSnapshot.keyLevels,
      marketSnapshot: latestSignalSnapshot.marketSnapshot,
      source: "signal",
    };
  }

  if (!latestAnalysis) {
    return null;
  }

  return {
    generatedAt: latestAnalysis.generatedAt,
    indicatorSnapshot: latestAnalysis.indicatorSnapshot,
    keyLevels: latestAnalysis.keyLevels,
    marketSnapshot: latestAnalysis.marketSnapshot,
    source: "analysis",
  };
}
