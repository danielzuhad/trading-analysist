import { pingDatabase } from "@trading-analyst/db";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { ApiEnv } from "../env.js";

type Dependencies = {
  env: ApiEnv;
  redis: Redis;
};

export async function registerHealthRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/health", async () => {
    return {
      service: "api",
      status: "ok",
      environment: dependencies.env.NODE_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/readyz", async (_, reply) => {
    const checks = {
      database: false,
      redis: false,
    };

    try {
      await pingDatabase();
      checks.database = true;
    } catch (error) {
      app.log.error({ error }, "database readiness check failed");
    }

    try {
      const response = await dependencies.redis.ping();
      checks.redis = response === "PONG";
    } catch (error) {
      app.log.error({ error }, "redis readiness check failed");
    }

    const ready = checks.database && checks.redis;

    return reply.code(ready ? 200 : 503).send({
      service: "api",
      status: ready ? "ready" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
