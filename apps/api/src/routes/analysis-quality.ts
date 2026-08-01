import {
  type AnalysisOutcome,
  type AnalysisQualityResponse,
  analysisOutcomeStatusSchema,
  assetStateSchema,
  type SupportedTimeframe,
  supportedTimeframeSchema,
} from "@trading-analyst/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const analysisQualityQuerySchema = z.object({
  modelUsed: z.string().trim().min(1).optional(),
  timeframe: supportedTimeframeSchema.optional(),
});

const analysisOutcomesQuerySchema = z.object({
  assetId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  state: assetStateSchema.optional(),
  status: analysisOutcomeStatusSchema.optional(),
  timeframe: supportedTimeframeSchema.optional(),
});

type Dependencies = {
  getAnalysisQualitySummary: (filters: {
    modelUsed?: string;
    timeframe?: SupportedTimeframe;
  }) => Promise<AnalysisQualityResponse>;
  listAnalysisOutcomes: (filters: {
    assetId?: string;
    limit?: number;
    state?: AnalysisOutcome["state"];
    status?: AnalysisOutcome["status"];
    timeframe?: SupportedTimeframe;
  }) => Promise<AnalysisOutcome[]>;
};

export async function registerAnalysisQualityRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/analysis-quality", async (request, reply) => {
    const queryResult = analysisQualityQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const { modelUsed, timeframe } = queryResult.data;

    return dependencies.getAnalysisQualitySummary({
      ...(modelUsed ? { modelUsed } : {}),
      ...(timeframe ? { timeframe } : {}),
    });
  });

  app.get("/analysis-outcomes", async (request, reply) => {
    if (request.user?.role !== "admin") {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const queryResult = analysisOutcomesQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const { assetId, limit, state, status, timeframe } = queryResult.data;
    const outcomes = await dependencies.listAnalysisOutcomes({
      limit,
      ...(assetId ? { assetId } : {}),
      ...(state ? { state } : {}),
      ...(status ? { status } : {}),
      ...(timeframe ? { timeframe } : {}),
    });

    return {
      count: outcomes.length,
      outcomes,
    };
  });
}
