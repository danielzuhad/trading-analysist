import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { ApiEnv } from "../env.js";

export type ReadinessCheck = {
  hint?: string;
  message?: string;
  ok: boolean;
  target?: string;
};

type Dependencies = {
  env: ApiEnv;
  checkDatabase: () => Promise<void>;
  redis: Redis;
};

export function formatServiceTarget(url: string): string | undefined {
  try {
    const parsedUrl = new URL(url);

    return parsedUrl.port
      ? `${parsedUrl.hostname}:${parsedUrl.port}`
      : parsedUrl.hostname;
  } catch {
    return undefined;
  }
}

export function formatInfrastructureCheckFailure(
  serviceName: "PostgreSQL" | "Redis",
  target: string | undefined,
  error: unknown,
): Omit<ReadinessCheck, "ok"> {
  const baseMessage = target
    ? `${serviceName} is not reachable at ${target}.`
    : `${serviceName} is not reachable.`;
  const errorCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;
  const errorMessage =
    error instanceof Error ? error.message : "Unknown connection error";

  if (serviceName === "Redis") {
    const failure: Omit<ReadinessCheck, "ok"> = {
      hint: "Start Redis or Docker Compose, then retry the worker and API.",
      message: `${baseMessage} The worker will keep logging connection errors until Redis is available.`,
    };

    if (target !== undefined) {
      failure.target = target;
    }

    return failure;
  }

  const failure: Omit<ReadinessCheck, "ok"> = {
    hint:
      errorCode === "ECONNREFUSED"
        ? "Start PostgreSQL or Docker Compose, then retry the API."
        : "Inspect the PostgreSQL connection settings, then retry the API.",
    message: `${baseMessage} ${errorMessage}`,
  };

  if (target !== undefined) {
    failure.target = target;
  }

  return failure;
}

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
    const databaseTarget = formatServiceTarget(dependencies.env.DATABASE_URL);
    const redisTarget = formatServiceTarget(dependencies.env.REDIS_URL);
    const checks: {
      database: ReadinessCheck;
      redis: ReadinessCheck;
    } = {
      database:
        databaseTarget === undefined
          ? { ok: false }
          : { ok: false, target: databaseTarget },
      redis:
        redisTarget === undefined
          ? { ok: false }
          : { ok: false, target: redisTarget },
    };

    try {
      await dependencies.checkDatabase();
      checks.database.ok = true;
    } catch (error) {
      app.log.error({ error }, "database readiness check failed");
      Object.assign(
        checks.database,
        formatInfrastructureCheckFailure(
          "PostgreSQL",
          checks.database.target,
          error,
        ),
      );
    }

    try {
      const response = await dependencies.redis.ping();
      checks.redis.ok = response === "PONG";

      if (!checks.redis.ok) {
        Object.assign(
          checks.redis,
          formatInfrastructureCheckFailure(
            "Redis",
            checks.redis.target,
            new Error(`Unexpected Redis ping response: ${response}`),
          ),
        );
      }
    } catch (error) {
      app.log.error({ error }, "redis readiness check failed");
      Object.assign(
        checks.redis,
        formatInfrastructureCheckFailure("Redis", checks.redis.target, error),
      );
    }

    const ready = checks.database.ok && checks.redis.ok;
    const issues = [checks.database, checks.redis].flatMap((check) =>
      check.ok || !check.message ? [] : [check.message],
    );

    return reply.code(ready ? 200 : 503).send({
      service: "api",
      status: ready ? "ready" : "degraded",
      checks,
      issues,
      timestamp: new Date().toISOString(),
    });
  });
}
