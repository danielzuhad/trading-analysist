import type {
  LatestAssetAnalysis,
  LatestMarketData,
} from "@trading-analyst/db";
import {
  type Asset,
  type AssetOverviewResponse,
  assetOverviewResponseSchema,
  defaultCryptoWatchlistAssets,
  findDefaultCryptoAsset,
  type IndicatorSnapshot,
  type OverviewStatus,
  type Position,
  pickLatestAnalysisRiskLevel,
  type SignalAggregationSnapshot,
  type SupportedTimeframe,
  supportedTimeframeSchema,
  type WatchlistOverviewItem,
  watchlistOverviewResponseSchema,
} from "@trading-analyst/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const overviewQuerySchema = z.object({
  timeframe: supportedTimeframeSchema.default("4H"),
});

const assetOverviewParamsSchema = z.object({
  assetId: z.string().trim().min(1),
});

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

type Dependencies = {
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
  }) => Promise<Position | null>;
};

type LatestAssetSnapshots = {
  analysisSnapshot: LatestAssetAnalysis | null;
  activePosition: Position | null;
  indicatorSnapshot: IndicatorSnapshot | null;
  marketData: LatestMarketData | null;
  signalSnapshot: SignalAggregationSnapshot | null;
};

export async function registerDashboardRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/watchlist/overview", async (request, reply) => {
    const queryResult = overviewQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    return buildWatchlistOverviewResponse(
      queryResult.data.timeframe,
      dependencies,
    );
  });

  app.get("/assets/:assetId/overview", async (request, reply) => {
    const paramsResult = assetOverviewParamsSchema.safeParse(request.params);
    const queryResult = overviewQuerySchema.safeParse(request.query);

    if (!paramsResult.success || !queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        issues: [
          ...(paramsResult.success ? [] : paramsResult.error.issues),
          ...(queryResult.success ? [] : queryResult.error.issues),
        ],
      });
    }

    const asset = findDefaultCryptoAsset(paramsResult.data.assetId);

    if (!asset) {
      return reply.code(404).send({
        error: "ASSET_NOT_FOUND",
        assetId: paramsResult.data.assetId,
      });
    }

    return buildAssetOverviewResponse(
      asset,
      queryResult.data.timeframe,
      dependencies,
    );
  });
}

export async function buildWatchlistOverviewResponse(
  timeframe: SupportedTimeframe,
  dependencies: Dependencies,
) {
  const generatedAt = new Date().toISOString();
  const items = await Promise.all(
    defaultCryptoWatchlistAssets.map(async (asset) =>
      buildWatchlistOverviewItem(asset, timeframe, dependencies),
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
  timeframe: SupportedTimeframe,
  dependencies: Dependencies,
): Promise<AssetOverviewResponse> {
  const snapshots = await loadLatestAssetSnapshots(
    asset.id,
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
  timeframe: SupportedTimeframe,
  dependencies: Dependencies,
): Promise<WatchlistOverviewItem> {
  const snapshots = await loadLatestAssetSnapshots(
    asset.id,
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
  timeframe: SupportedTimeframe,
  dependencies: Dependencies,
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
    dependencies.getActivePositionForAsset({ assetId }),
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
