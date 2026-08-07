import {
  type Alert,
  type AlertResolution,
  type AlertStatus,
  alertResolutionSchema,
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

const alertParamsSchema = z.object({
  alertId: z.string().trim().min(1),
});

const resolveAlertBodySchema = z.object({
  status: alertResolutionSchema,
});

type Dependencies = {
  listAlerts: (filters: {
    assetId?: string;
    limit?: number;
    status?: AlertStatus;
    timeframe?: SupportedTimeframe;
    userId: string;
  }) => Promise<Alert[]>;
  resolveAlert: (
    alertId: string,
    input: { resolution: AlertResolution; userId: string },
  ) => Promise<Alert | null>;
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

  app.patch("/alerts/:alertId", async (request, reply) => {
    const userId = request.user?.userId;

    if (!userId) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const paramsResult = alertParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      return reply.code(400).send({
        error: "INVALID_PARAMS",
        issues: paramsResult.error.issues,
      });
    }

    const bodyResult = resolveAlertBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      return reply.code(400).send({
        error: "INVALID_BODY",
        issues: bodyResult.error.issues,
      });
    }

    const { alertId } = paramsResult.data;
    const alert = await dependencies.resolveAlert(alertId, {
      resolution: bodyResult.data.status,
      userId,
    });

    // Also 404 when the alert exists but belongs to someone else — telling
    // the caller apart from "does not exist" would leak other users' alert ids.
    if (!alert) {
      return reply.code(404).send({
        alertId,
        error: "ALERT_NOT_FOUND",
      });
    }

    return { alert };
  });
}
