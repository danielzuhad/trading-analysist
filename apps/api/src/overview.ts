import type {
  LatestAssetAnalysis,
  LatestMarketData,
} from "@trading-analyst/db";
import {
  type Asset,
  type AssetOverviewResponse,
  assetOverviewResponseSchema,
  defaultCryptoWatchlistAssets,
  type IndicatorSnapshot,
  type OverviewStatus,
  type Position,
  pickLatestAnalysisRiskLevel,
  type SignalAggregationSnapshot,
  type SupportedTimeframe,
  type WatchlistOverviewItem,
  watchlistOverviewResponseSchema,
} from "@trading-analyst/shared-types";

const statePriority: Partial<
  Record<NonNullable<WatchlistOverviewItem["state"]>, number>
> = {
  ACTIONABLE: 7,
  EXIT_WARNING: 6,
  PREPARE: 5,
  IN_POSITION: 4,
  WATCH: 3,
  IGNORE: 2,
  INVALID: 1,
};

const statusPriority: Record<OverviewStatus, number> = {
  pending: 0,
  partial: 1,
  ready: 2,
};

export type OverviewDependencies = {
  getLatestAssetAnalysis: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<LatestAssetAnalysis | null>;
  getLatestIndicatorSnapshot: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<IndicatorSnapshot | null>;
  getLatestMarketData: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<LatestMarketData | null>;
  getLatestSignalAggregationSnapshot: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<SignalAggregationSnapshot | null>;
  getActivePositionForAsset: (filters: {
    assetId: string;
    userId: string;
  }) => Promise<Position | null>;
};

type LatestAssetSnapshots = {
  analysisSnapshot: LatestAssetAnalysis | null;
  activePosition: Position | null;
  indicatorSnapshot: IndicatorSnapshot | null;
  marketData: LatestMarketData | null;
  signalSnapshot: SignalAggregationSnapshot | null;
};

export async function resolveWatchlistAssetsForOverview(
  userId: string,
  listWatchlistAssets:
    | ((userId: string) => Promise<Array<{ asset: Asset }>>)
    | undefined,
): Promise<Asset[]> {
  if (listWatchlistAssets) {
    try {
      const entries = await listWatchlistAssets(userId);

      if (entries.length > 0) {
        return entries.map((entry) => entry.asset);
      }
    } catch {
      // fall through to the seeded defaults below
    }
  }

  return defaultCryptoWatchlistAssets;
}

export async function buildWatchlistOverviewResponse(
  userId: string,
  timeframe: SupportedTimeframe,
  overviewAssets: Asset[],
  dependencies: OverviewDependencies,
) {
  const generatedAt = new Date().toISOString();
  const items = await Promise.all(
    overviewAssets.map(async (asset) =>
      buildWatchlistOverviewItem(asset, userId, timeframe, dependencies),
    ),
  );

  items.sort(compareOverviewItems);

  return watchlistOverviewResponseSchema.parse({
    timeframe,
    generatedAt,
    items,
  });
}

export async function buildAssetOverviewResponse(
  asset: Asset,
  userId: string,
  timeframe: SupportedTimeframe,
  dependencies: OverviewDependencies,
): Promise<AssetOverviewResponse> {
  const snapshots = await loadLatestAssetSnapshots(
    asset.id,
    userId,
    timeframe,
    dependencies,
  );
  const missingData = listMissingData(snapshots);

  return assetOverviewResponseSchema.parse({
    asset,
    timeframe,
    generatedAt: new Date().toISOString(),
    status: resolveOverviewStatus(missingData),
    missingData,
    ...(snapshots.marketData
      ? { marketSnapshot: snapshots.marketData.snapshot }
      : {}),
    ...(snapshots.indicatorSnapshot
      ? { indicatorSnapshot: snapshots.indicatorSnapshot }
      : {}),
    ...(snapshots.signalSnapshot
      ? { signalSnapshot: snapshots.signalSnapshot }
      : {}),
    ...(snapshots.analysisSnapshot
      ? { analysisSnapshot: snapshots.analysisSnapshot }
      : {}),
    ...(snapshots.activePosition
      ? { activePosition: snapshots.activePosition }
      : {}),
  });
}

async function buildWatchlistOverviewItem(
  asset: Asset,
  userId: string,
  timeframe: SupportedTimeframe,
  dependencies: OverviewDependencies,
): Promise<WatchlistOverviewItem> {
  const snapshots = await loadLatestAssetSnapshots(
    asset.id,
    userId,
    timeframe,
    dependencies,
  );
  const missingData = listMissingData(snapshots);
  const { analysisSnapshot, marketData, signalSnapshot } = snapshots;

  return {
    asset,
    timeframe,
    status: resolveOverviewStatus(missingData),
    missingData,
    ...(marketData
      ? {
          marketCapturedAt: marketData.snapshot.capturedAt,
          provider: marketData.snapshot.provider,
          lastPrice: marketData.snapshot.lastPrice,
          ...(marketData.snapshot.priceChangePercent !== undefined
            ? { priceChangePercent: marketData.snapshot.priceChangePercent }
            : {}),
        }
      : {}),
    ...(analysisSnapshot
      ? {
          analysisGeneratedAt: analysisSnapshot.generatedAt,
          state: analysisSnapshot.state,
          suggestion: analysisSnapshot.suggestion,
          signalStrengthScore: analysisSnapshot.signalStrengthScore,
          aiConfidence: analysisSnapshot.aiConfidence,
          regime: analysisSnapshot.regime,
          bias: analysisSnapshot.bias,
          riskLevel: pickLatestAnalysisRiskLevel(analysisSnapshot),
          summary: analysisSnapshot.summary,
          keyReasons: analysisSnapshot.decisionCard.keyReasons,
          concerns: analysisSnapshot.concerns,
          nearestSupport: analysisSnapshot.keyLevels.nearestSupport,
          nearestResistance: analysisSnapshot.keyLevels.nearestResistance,
          invalidation: analysisSnapshot.keyLevels.invalidation,
        }
      : signalSnapshot
        ? {
            signalStrengthScore: signalSnapshot.signalStrengthScore,
            regime: signalSnapshot.regime,
            bias: signalSnapshot.bias,
            summary: signalSnapshot.summary,
            keyReasons: [],
            concerns: signalSnapshot.riskFlags,
            nearestSupport: signalSnapshot.keyLevels.nearestSupport,
            nearestResistance: signalSnapshot.keyLevels.nearestResistance,
            invalidation: signalSnapshot.keyLevels.invalidation,
          }
        : {
            keyReasons: [],
            concerns: [],
          }),
  };
}

async function loadLatestAssetSnapshots(
  assetId: string,
  userId: string,
  timeframe: SupportedTimeframe,
  dependencies: OverviewDependencies,
): Promise<LatestAssetSnapshots> {
  const [
    marketData,
    indicatorSnapshot,
    signalSnapshot,
    analysisSnapshot,
    activePosition,
  ] = await Promise.all([
    dependencies.getLatestMarketData(assetId, timeframe),
    dependencies.getLatestIndicatorSnapshot(assetId, timeframe),
    dependencies.getLatestSignalAggregationSnapshot(assetId, timeframe),
    dependencies.getLatestAssetAnalysis(assetId, timeframe),
    dependencies.getActivePositionForAsset({ assetId, userId }),
  ]);

  return {
    analysisSnapshot,
    activePosition,
    indicatorSnapshot,
    marketData,
    signalSnapshot,
  };
}

function listMissingData(snapshots: LatestAssetSnapshots) {
  return [
    ...(snapshots.marketData ? [] : ["market_snapshot"]),
    ...(snapshots.indicatorSnapshot ? [] : ["indicator_snapshot"]),
    ...(snapshots.signalSnapshot ? [] : ["signal_snapshot"]),
    ...(snapshots.analysisSnapshot ? [] : ["analysis_snapshot"]),
  ];
}

function resolveOverviewStatus(missingData: string[]): OverviewStatus {
  if (missingData.length === 0) {
    return "ready";
  }

  if (missingData.length === 4) {
    return "pending";
  }

  return "partial";
}

function compareOverviewItems(
  left: WatchlistOverviewItem,
  right: WatchlistOverviewItem,
) {
  return (
    statusPriority[right.status] - statusPriority[left.status] ||
    (statePriority[right.state ?? "INVALID"] ?? 0) -
      (statePriority[left.state ?? "INVALID"] ?? 0) ||
    (right.signalStrengthScore ?? -1) - (left.signalStrengthScore ?? -1) ||
    (right.aiConfidence ?? -1) - (left.aiConfidence ?? -1) ||
    (right.priceChangePercent ?? Number.NEGATIVE_INFINITY) -
      (left.priceChangePercent ?? Number.NEGATIVE_INFINITY) ||
    left.asset.symbol.localeCompare(right.asset.symbol)
  );
}
