import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { ApiEnv } from "../env.js";

export type ReadinessCheck = {
  hint?: string;
  message?: string;
  ok: boolean;
  target?: string;
};

export type OperationalProviderStatus = {
  checkedAt?: string;
  detail?: string;
  latencyMs?: number;
  status: "active" | "degraded" | "down" | "disabled";
};

export type AiOperationalStatus = {
  checkedAt?: string;
  currentState: "cap-reached" | "disabled" | "ok" | "unknown";
  detail?: string;
  maxDailyAiCostUsd?: number;
};

type Dependencies = {
  env: ApiEnv;
  checkDatabase: () => Promise<void>;
  listOperationalHeartbeats: () => Promise<
    Array<{
      checkedAt: string;
      payload: Record<string, unknown> | null;
      serviceName: string;
      status: string;
    }>
  >;
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
    const operational = await buildOperationalStatus(
      dependencies.listOperationalHeartbeats,
    );

    return {
      service: "api",
      status: "ok",
      environment: dependencies.env.NODE_ENV,
      operational,
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
    const operational = await buildOperationalStatus(
      dependencies.listOperationalHeartbeats,
    );

    return reply.code(ready ? 200 : 503).send({
      service: "api",
      status: ready ? "ready" : "degraded",
      checks,
      issues,
      operational,
      timestamp: new Date().toISOString(),
    });
  });
}

async function buildOperationalStatus(
  listOperationalHeartbeats: Dependencies["listOperationalHeartbeats"],
) {
  let heartbeats: Awaited<
    ReturnType<Dependencies["listOperationalHeartbeats"]>
  >;

  try {
    heartbeats = await listOperationalHeartbeats();
  } catch {
    return {
      ai: { currentState: "unknown" as const },
      providers: {},
    };
  }

  const providers = Object.fromEntries(
    heartbeats
      .filter((heartbeat) => heartbeat.serviceName.startsWith("provider:"))
      .map((heartbeat) => [
        heartbeat.serviceName.replace("provider:", ""),
        mapProviderHeartbeat(heartbeat),
      ]),
  ) as Record<string, OperationalProviderStatus>;
  const aiHeartbeat = heartbeats.find(
    (heartbeat) => heartbeat.serviceName === "ai:daily-cost-cap",
  );

  return {
    ai: aiHeartbeat ? mapAiHeartbeat(aiHeartbeat) : { currentState: "unknown" },
    providers,
  };
}

function mapAiHeartbeat(heartbeat: {
  checkedAt: string;
  payload: Record<string, unknown> | null;
  status: string;
}): AiOperationalStatus {
  if (heartbeat.status === "degraded") {
    const maxDailyAiCostUsd = readNumberField(
      heartbeat.payload,
      "maxDailyAiCostUsd",
    );

    return {
      checkedAt: heartbeat.checkedAt,
      currentState: "cap-reached",
      detail: "Daily AI cost cap is currently blocking non-critical analyses.",
      ...(maxDailyAiCostUsd !== undefined ? { maxDailyAiCostUsd } : {}),
    };
  }

  if (heartbeat.status === "disabled") {
    const maxDailyAiCostUsd = readNumberField(
      heartbeat.payload,
      "maxDailyAiCostUsd",
    );

    return {
      checkedAt: heartbeat.checkedAt,
      currentState: "disabled",
      detail:
        "AI analysis is disabled because OPENAI_API_KEY is not configured.",
      ...(maxDailyAiCostUsd !== undefined ? { maxDailyAiCostUsd } : {}),
    };
  }

  const maxDailyAiCostUsd = readNumberField(
    heartbeat.payload,
    "maxDailyAiCostUsd",
  );

  return {
    checkedAt: heartbeat.checkedAt,
    currentState: "ok",
    ...(maxDailyAiCostUsd !== undefined ? { maxDailyAiCostUsd } : {}),
  };
}

function mapProviderHeartbeat(heartbeat: {
  checkedAt: string;
  payload: Record<string, unknown> | null;
  status: string;
}): OperationalProviderStatus {
  const detail = readStringField(heartbeat.payload, "detail");
  const latencyMs = readNumberField(heartbeat.payload, "latencyMs");

  return {
    checkedAt: heartbeat.checkedAt,
    status: normalizeProviderStatus(heartbeat.status),
    ...(detail ? { detail } : {}),
    ...(latencyMs !== undefined ? { latencyMs } : {}),
  };
}

function normalizeProviderStatus(
  value: string,
): OperationalProviderStatus["status"] {
  if (
    value === "active" ||
    value === "degraded" ||
    value === "down" ||
    value === "disabled"
  ) {
    return value;
  }

  return "degraded";
}

function readNumberField(
  payload: Record<string, unknown> | null,
  field: string,
) {
  const value = payload?.[field];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readStringField(
  payload: Record<string, unknown> | null,
  field: string,
) {
  const value = payload?.[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
