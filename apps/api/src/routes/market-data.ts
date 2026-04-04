import type { LatestMarketData } from "@trading-analyst/db";
import type {
  IndicatorSnapshot,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";
import { supportedTimeframeSchema } from "@trading-analyst/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const latestMarketDataQuerySchema = z.object({
  assetId: z.string().trim().min(1),
  timeframe: supportedTimeframeSchema.default("1H"),
});

type Dependencies = {
  getLatestMarketData: (
    assetId: string,
    timeframe: "1H" | "4H",
  ) => Promise<LatestMarketData | null>;
  getLatestIndicatorSnapshot: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<IndicatorSnapshot | null>;
};

export async function registerMarketDataRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/market-snapshots/latest", async (request, reply) => {
    const queryResult = latestMarketDataQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const { assetId, timeframe } = queryResult.data;
    const latestMarketData = await dependencies.getLatestMarketData(
      assetId,
      timeframe,
    );

    if (!latestMarketData) {
      return reply.code(404).send({
        error: "MARKET_SNAPSHOT_NOT_FOUND",
        assetId,
        timeframe,
      });
    }

    return {
      series: latestMarketData.series,
      snapshot: latestMarketData.snapshot,
    };
  });

  app.get("/indicator-snapshots/latest", async (request, reply) => {
    const queryResult = latestMarketDataQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const { assetId, timeframe } = queryResult.data;
    const indicatorSnapshot = await dependencies.getLatestIndicatorSnapshot(
      assetId,
      timeframe,
    );

    if (!indicatorSnapshot) {
      return reply.code(404).send({
        error: "INDICATOR_SNAPSHOT_NOT_FOUND",
        assetId,
        timeframe,
      });
    }

    return {
      snapshot: indicatorSnapshot,
    };
  });
}
