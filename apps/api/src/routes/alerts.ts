import {
  type Alert,
  type AlertStatus,
  alertStatusSchema,
  type SupportedTimeframe,
  supportedTimeframeSchema,
} from "@trading-analyst/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const alertsQuerySchema = z.object({
  assetId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: alertStatusSchema.optional(),
  timeframe: supportedTimeframeSchema.optional(),
});

type Dependencies = {
  listAlerts: (filters: {
    assetId?: string;
    limit?: number;
    status?: AlertStatus;
    timeframe?: SupportedTimeframe;
    userId: string;
  }) => Promise<Alert[]>;
};

export async function registerAlertRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/alerts", async (request, reply) => {
    const userId = request.user?.userId;

    if (!userId) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const queryResult = alertsQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const { assetId, limit, status, timeframe } = queryResult.data;
    const alerts = await dependencies.listAlerts({
      limit,
      userId,
      ...(assetId ? { assetId } : {}),
      ...(status ? { status } : {}),
      ...(timeframe ? { timeframe } : {}),
    });

    return {
      alerts,
      count: alerts.length,
    };
  });
}
