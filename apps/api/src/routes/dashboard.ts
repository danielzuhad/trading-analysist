import {
  type Asset,
  findDefaultCryptoAsset,
  supportedTimeframeSchema,
} from "@trading-analyst/shared-types";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  buildAssetOverviewResponse,
  buildWatchlistOverviewResponse,
  type OverviewDependencies,
  resolveWatchlistAssetsForOverview,
} from "../overview.js";

const overviewQuerySchema = z.object({
  timeframe: supportedTimeframeSchema.default("4H"),
});

const assetOverviewParamsSchema = z.object({
  assetId: z.string().trim().min(1),
});

type Dependencies = OverviewDependencies & {
  listWatchlistAssets?: (userId: string) => Promise<Array<{ asset: Asset }>>;
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

async function resolveDashboardAsset(
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

export async function registerDashboardRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/watchlist/overview", async (request, reply) => {
    const userId = requireUserId(request);
    const queryResult = overviewQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const overviewAssets = await resolveWatchlistAssetsForOverview(
      userId,
      dependencies.listWatchlistAssets,
    );

    return buildWatchlistOverviewResponse(
      userId,
      queryResult.data.timeframe,
      overviewAssets,
      dependencies,
    );
  });

  app.get("/assets/:assetId/overview", async (request, reply) => {
    const userId = requireUserId(request);
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

    const asset = await resolveDashboardAsset(
      paramsResult.data.assetId,
      userId,
      dependencies,
    );

    if (!asset) {
      return reply.code(404).send({
        error: "ASSET_NOT_FOUND",
        assetId: paramsResult.data.assetId,
      });
    }

    return buildAssetOverviewResponse(
      asset,
      userId,
      queryResult.data.timeframe,
      dependencies,
    );
  });
}
