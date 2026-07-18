import {
  type AnalysisQualityResponse,
  type SupportedTimeframe,
  supportedTimeframeSchema,
} from "@trading-analyst/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const analysisQualityQuerySchema = z.object({
  modelUsed: z.string().trim().min(1).optional(),
  timeframe: supportedTimeframeSchema.optional(),
});

type Dependencies = {
  getAnalysisQualitySummary: (filters: {
    modelUsed?: string;
    timeframe?: SupportedTimeframe;
  }) => Promise<AnalysisQualityResponse>;
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
}
