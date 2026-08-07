import type {
  MarketSnapshotJobData,
  WatchlistAssetEntry,
} from "@trading-analyst/shared-types";
import { supportedTimeframeSchema } from "@trading-analyst/shared-types";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

const analyzeParamsSchema = z.object({
  assetId: z.string().trim().min(1),
});

const analyzeBodySchema = z.object({
  timeframe: supportedTimeframeSchema.default("4H"),
});

type Dependencies = {
  enqueueAnalysisJob: (
    data: MarketSnapshotJobData,
  ) => Promise<{ jobId: string }>;
  getWatchlistAsset: (filters: {
    assetId: string;
    userId: string;
  }) => Promise<WatchlistAssetEntry | null>;
};

function requireUserId(request: FastifyRequest): string {
  const userId = request.user?.userId;

  if (!userId) {
    throw new Error("Route registered without an authenticated request.");
  }

  return userId;
}

export async function registerAnalysisRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  /**
   * Manual re-analysis. Unlike the scheduler this bypasses the
   * "snapshot unchanged" guard, so every accepted request costs a real AI
   * call — hence the rate limit, the watchlist-ownership check (otherwise one
   * user could burn another's daily budget) and the aiEnabled check (the user
   * already said they don't want to spend on this asset).
   */
  app.post(
    "/assets/:assetId/analyze",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "5 minutes",
        },
      },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const paramsResult = analyzeParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.code(400).send({
          error: "INVALID_PARAMS",
          issues: paramsResult.error.issues,
        });
      }

      const bodyResult = analyzeBodySchema.safeParse(request.body ?? {});

      if (!bodyResult.success) {
        return reply.code(400).send({
          error: "INVALID_BODY",
          issues: bodyResult.error.issues,
        });
      }

      const { assetId } = paramsResult.data;
      const { timeframe } = bodyResult.data;
      const entry = await dependencies.getWatchlistAsset({ assetId, userId });

      if (!entry) {
        return reply.code(404).send({
          assetId,
          error: "ASSET_NOT_IN_WATCHLIST",
        });
      }

      if (!entry.aiEnabled) {
        return reply.code(409).send({
          assetId,
          error: "AI_DISABLED_FOR_ASSET",
        });
      }

      const { jobId } = await dependencies.enqueueAnalysisJob({
        assetId,
        requestedAt: new Date().toISOString(),
        timeframe,
        trigger: "manual",
        userId,
      });

      return reply.code(202).send({
        assetId,
        jobId,
        status: "queued",
        timeframe,
      });
    },
  );
}
