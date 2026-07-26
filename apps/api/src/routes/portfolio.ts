import {
  type Asset,
  findDefaultCryptoAsset,
  type PortfolioConcentrationWarning,
  type PortfolioPositionSummary,
  type Position,
  portfolioOverviewResponseSchema,
} from "@trading-analyst/shared-types";
import type { FastifyInstance, FastifyRequest } from "fastify";

const DIRECTION_CONCENTRATION_THRESHOLD_PERCENT = 80;
const SINGLE_ASSET_CONCENTRATION_THRESHOLD_PERCENT = 50;

type Dependencies = {
  listPositions: (filters: {
    activeOnly: boolean;
    userId: string;
  }) => Promise<Position[]>;
  getWatchlistAsset?: (filters: {
    assetId: string;
    userId: string;
  }) => Promise<{ asset: Asset } | null>;
};

function requireUserId(request: FastifyRequest): string {
  const userId = request.user?.userId;

  if (!userId) {
    throw new Error("Route registered without an authenticated request.");
  }

  return userId;
}

export async function registerPortfolioRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/portfolio/overview", async (request) => {
    const userId = requireUserId(request);
    return buildPortfolioOverviewResponse(userId, dependencies);
  });
}

export async function buildPortfolioOverviewResponse(
  userId: string,
  dependencies: Dependencies,
) {
  const activePositions = await dependencies.listPositions({
    activeOnly: true,
    userId,
  });

  const positionsWithAssets = await Promise.all(
    activePositions.map(async (position) => ({
      position,
      asset: await resolvePositionAsset(position.assetId, userId, dependencies),
    })),
  );

  const totalNotionalValue = positionsWithAssets.reduce(
    (sum, entry) => sum + resolveNotionalValue(entry.position),
    0,
  );

  const positions: PortfolioPositionSummary[] = positionsWithAssets.map(
    ({ position, asset }) => {
      const notionalValue = resolveNotionalValue(position);

      return {
        asset: asset ?? buildUnknownAsset(position.assetId),
        positionId: position.id,
        direction: position.direction,
        notionalValue,
        ...(position.unrealizedPnl !== undefined
          ? { unrealizedPnl: position.unrealizedPnl }
          : {}),
        ...(position.unrealizedPnlPercent !== undefined
          ? { unrealizedPnlPercent: position.unrealizedPnlPercent }
          : {}),
        exposurePercent: sharePercent(notionalValue, totalNotionalValue),
      };
    },
  );

  const totalUnrealizedPnl = activePositions.reduce(
    (sum, position) => sum + (position.unrealizedPnl ?? 0),
    0,
  );

  const longNotionalValue = positionsWithAssets.reduce(
    (sum, entry) =>
      entry.position.direction === "long"
        ? sum + resolveNotionalValue(entry.position)
        : sum,
    0,
  );
  const shortNotionalValue = totalNotionalValue - longNotionalValue;

  const longExposurePercent = sharePercent(
    longNotionalValue,
    totalNotionalValue,
  );
  const shortExposurePercent = sharePercent(
    shortNotionalValue,
    totalNotionalValue,
  );

  const concentrationWarnings = buildConcentrationWarnings({
    longExposurePercent,
    shortExposurePercent,
    positions,
  });

  return portfolioOverviewResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    openPositionCount: activePositions.length,
    totalNotionalValue,
    totalUnrealizedPnl,
    longExposurePercent,
    shortExposurePercent,
    positions,
    concentrationWarnings,
  });
}

async function resolvePositionAsset(
  assetId: string,
  userId: string,
  dependencies: Dependencies,
): Promise<Asset | undefined> {
  const seeded = findDefaultCryptoAsset(assetId);

  if (seeded) {
    return seeded;
  }

  if (!dependencies.getWatchlistAsset) {
    return undefined;
  }

  try {
    const entry = await dependencies.getWatchlistAsset({ assetId, userId });
    return entry?.asset;
  } catch {
    return undefined;
  }
}

function buildUnknownAsset(assetId: string): Asset {
  return {
    id: assetId,
    symbol: assetId,
    displaySymbol: assetId,
    name: assetId,
    assetClass: "crypto",
    market: "global",
    exchange: "global",
    instrumentType: "spot",
    isActive: true,
    metadata: {},
  };
}

function resolveNotionalValue(position: Position): number {
  if (position.notionalValue !== undefined) {
    return position.notionalValue;
  }

  return position.remainingQuantity * position.entryPrice;
}

function sharePercent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (part / total) * 100));
}

function buildConcentrationWarnings({
  longExposurePercent,
  shortExposurePercent,
  positions,
}: {
  longExposurePercent: number;
  shortExposurePercent: number;
  positions: PortfolioPositionSummary[];
}): PortfolioConcentrationWarning[] {
  const warnings: PortfolioConcentrationWarning[] = [];

  if (positions.length > 1) {
    const dominantDirectionPercent = Math.max(
      longExposurePercent,
      shortExposurePercent,
    );

    if (dominantDirectionPercent >= DIRECTION_CONCENTRATION_THRESHOLD_PERCENT) {
      const direction =
        longExposurePercent >= shortExposurePercent ? "long" : "short";

      warnings.push({
        kind: "direction_concentration",
        message: `${Math.round(dominantDirectionPercent)}% of open exposure is ${direction}, with no offsetting positions.`,
        exposurePercent: dominantDirectionPercent,
      });
    }
  }

  for (const position of positions) {
    if (
      position.exposurePercent >= SINGLE_ASSET_CONCENTRATION_THRESHOLD_PERCENT
    ) {
      warnings.push({
        kind: "single_asset_concentration",
        message: `${position.asset.symbol} alone accounts for ${Math.round(position.exposurePercent)}% of open exposure.`,
        exposurePercent: position.exposurePercent,
      });
    }
  }

  return warnings;
}
