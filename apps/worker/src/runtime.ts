import {
  ensureDefaultWatchlistAssets,
  listAllWatchlistUserIds,
  listWatchlistAssets,
} from "@trading-analyst/db";
import type { AnalysisTrigger } from "@trading-analyst/shared-types";
import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadWorkerEnv, type WorkerEnv } from "./env.js";
import { processOutcomeEvaluationJob } from "./outcomes.js";
import { runAnalysisCycle } from "./pipeline.js";
import {
  analysisQueueName,
  type MarketSnapshotJobData,
  marketSnapshotJobName,
  outcomeEvaluationJobName,
  thresholdCheckJobName,
  type WorkerJobTrigger,
} from "./queues.js";
import { processThresholdCheckJob } from "./thresholds.js";

type Logger = Pick<typeof console, "error" | "log" | "warn">;

export type AnalysisJobProcessor = (
  job: Job<MarketSnapshotJobData>,
) => Promise<void> | void;

type CreateWorkerRuntimeOptions = {
  env?: WorkerEnv;
  logger?: Logger;
  processor?: AnalysisJobProcessor;
  queueName?: string;
};

type StartWorkerRuntimeOptions = CreateWorkerRuntimeOptions & {
  enableScheduler?: boolean;
  enqueueBootstrapJob?: boolean;
};

export type WorkerRuntime = {
  analysisQueue: Queue<MarketSnapshotJobData>;
  env: WorkerEnv;
  queueName: string;
  queueConnection: Redis;
  shutdown: () => Promise<void>;
  worker: Worker<MarketSnapshotJobData>;
  workerConnection: Redis;
};

function runFullAnalysisCycle(
  job: Job<MarketSnapshotJobData>,
  env: WorkerEnv,
  logger: Logger,
  triggeredBy: AnalysisTrigger,
) {
  return runAnalysisCycle({
    assetId: job.data.assetId,
    ...(env.COINGECKO_API_KEY
      ? { coingeckoApiKey: env.COINGECKO_API_KEY }
      : {}),
    coingeckoApiPlan: env.COINGECKO_API_PLAN,
    connectionString: env.DATABASE_URL,
    logger,
    maxDailyAiCostUsd: env.MAX_DAILY_AI_COST_USD,
    ...(env.OPENAI_API_KEY ? { openAiApiKey: env.OPENAI_API_KEY } : {}),
    requestedAt: job.data.requestedAt,
    ...(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID
      ? {
          telegramAlertDelivery: {
            botToken: env.TELEGRAM_BOT_TOKEN,
            chatId: env.TELEGRAM_CHAT_ID,
          },
        }
      : {}),
    timeframe: job.data.timeframe,
    triggeredBy,
    userId: job.data.userId,
    ...(env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_WHATSAPP_FROM &&
    env.TWILIO_WHATSAPP_TO
      ? {
          whatsappAlertDelivery: {
            accountSid: env.TWILIO_ACCOUNT_SID,
            authToken: env.TWILIO_AUTH_TOKEN,
            from: env.TWILIO_WHATSAPP_FROM,
            ...(env.TWILIO_STATUS_CALLBACK_URL
              ? { statusCallbackUrl: env.TWILIO_STATUS_CALLBACK_URL }
              : {}),
            to: env.TWILIO_WHATSAPP_TO,
          },
        }
      : {}),
  });
}

async function defaultProcessor(
  job: Job<MarketSnapshotJobData>,
  env: WorkerEnv,
  logger: Logger,
) {
  if (job.name === marketSnapshotJobName) {
    const result = await runFullAnalysisCycle(
      job,
      env,
      logger,
      resolveAnalysisTrigger(job.data.trigger),
    );

    if (result.status === "skipped") {
      logger.warn(
        `[worker] analysis cycle skipped for ${result.assetId}: ${result.reason}`,
      );
      return;
    }

    if (result.analysis.status === "skipped") {
      logger.warn(
        `[worker] analysis cycle stored market data for ${result.assetId} ${result.timeframe}, but AI analysis was skipped: ${result.analysis.reason}`,
      );
      return;
    }

    logger.log(
      `[worker] completed full analysis cycle for ${result.assetId} ${result.timeframe} with context ${result.contextPartial ? "partial" : "complete"} and AI state ${result.analysis.state}`,
    );
    return;
  }

  if (job.name === outcomeEvaluationJobName) {
    const outcomeResult = await processOutcomeEvaluationJob({
      assetId: job.data.assetId,
      connectionString: env.DATABASE_URL,
      logger,
      requestedAt: job.data.requestedAt,
      timeframe: job.data.timeframe,
    });

    if (outcomeResult.status === "skipped_no_market_data") {
      logger.warn(
        `[worker] outcome evaluation skipped for ${outcomeResult.assetId} ${outcomeResult.timeframe}: no market data`,
      );
      return;
    }

    if (outcomeResult.evaluated > 0) {
      logger.log(
        `[worker] outcome evaluation completed for ${outcomeResult.assetId} ${outcomeResult.timeframe}: ${outcomeResult.evaluated} evaluated`,
      );
    }
    return;
  }

  if (job.name === thresholdCheckJobName) {
    const thresholdResult = await processThresholdCheckJob({
      ...(env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {}),
      apiPlan: env.COINGECKO_API_PLAN,
      assetId: job.data.assetId,
      connectionString: env.DATABASE_URL,
      requestedAt: job.data.requestedAt,
      timeframe: job.data.timeframe,
      userId: job.data.userId,
    });

    if (thresholdResult.status === "skipped") {
      logger.log(
        `[worker] threshold check skipped for ${thresholdResult.assetId} ${thresholdResult.timeframe}: ${thresholdResult.reason}`,
      );
      return;
    }

    logger.log(
      `[worker] threshold check triggered re-analysis for ${thresholdResult.assetId} ${thresholdResult.timeframe}: ${thresholdResult.level.kind} at ${thresholdResult.level.level} is ${thresholdResult.level.distance} away (ATR ${thresholdResult.thresholdDistance})`,
    );

    const result = await runFullAnalysisCycle(
      job,
      env,
      logger,
      "realtime_event",
    );

    if (result.status === "skipped") {
      logger.warn(
        `[worker] threshold-triggered analysis skipped for ${result.assetId}: ${result.reason}`,
      );
      return;
    }

    if (result.analysis.status === "skipped") {
      logger.warn(
        `[worker] threshold-triggered analysis stored market data for ${result.assetId} ${result.timeframe}, but AI analysis was skipped: ${result.analysis.reason}`,
      );
      return;
    }

    logger.log(
      `[worker] completed threshold-triggered analysis for ${result.assetId} ${result.timeframe} with context ${result.contextPartial ? "partial" : "complete"} and AI state ${result.analysis.state}`,
    );
    return;
  }
  logger.warn(`[worker] skipped unsupported job name "${job.name}"`);
}

export function createWorkerRuntime({
  env = loadWorkerEnv(),
  logger = console,
  processor,
  queueName = analysisQueueName,
}: CreateWorkerRuntimeOptions = {}): WorkerRuntime {
  const queueConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  // BullMQ workers use a blocking Redis flow and should not share the queue connection.
  const workerConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const analysisQueue = new Queue<MarketSnapshotJobData>(queueName, {
    connection: queueConnection,
  });

  const worker = new Worker<MarketSnapshotJobData>(
    queueName,
    async (job) => {
      const processJob =
        processor ??
        ((currentJob: Job<MarketSnapshotJobData>) =>
          defaultProcessor(currentJob, env, logger));
      await processJob(job);
    },
    {
      concurrency: env.WORKER_CONCURRENCY,
      connection: workerConnection,
    },
  );

  worker.on("completed", (job) => {
    logger.log(`[worker] completed job ${job.id ?? "unknown"}`);
  });

  worker.on("failed", (job, error) => {
    logger.error(
      `[worker] failed job ${job?.id ?? "unknown"}: ${formatWorkerError(error)}`,
    );
  });

  return {
    analysisQueue,
    env,
    queueName,
    queueConnection,
    shutdown: async () => {
      await worker.close();
      await analysisQueue.close();
      await queueConnection.quit();
      await workerConnection.quit();
    },
    worker,
    workerConnection,
  };
}

export function formatWorkerError(error: Error) {
  const details = readErrorDetails(error);
  const statusCode = details?.statusCode;
  const responseBody = details?.responseBody;

  return [
    error.message,
    typeof statusCode === "number" ? `status=${statusCode}` : undefined,
    typeof responseBody === "string" && responseBody.length > 0
      ? `body=${responseBody}`
      : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function readErrorDetails(error: Error) {
  if (!("details" in error) || !isRecord(error.details)) {
    return undefined;
  }

  return error.details;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function startWorkerRuntime(
  options: StartWorkerRuntimeOptions = {},
): Promise<WorkerRuntime> {
  const runtime = createWorkerRuntime(options);
  const logger = options.logger ?? console;
  const shouldEnqueueBootstrapJob =
    options.enqueueBootstrapJob ?? runtime.env.NODE_ENV !== "production";
  const shouldEnableScheduler =
    options.enableScheduler ??
    (runtime.env.NODE_ENV !== "test" && runtime.env.WORKER_ENABLE_SCHEDULER);
  const shouldEnableThresholdChecks =
    shouldEnableScheduler && runtime.env.WORKER_ENABLE_THRESHOLD_CHECKS;
  const shouldEnableOutcomeEvaluation =
    shouldEnableScheduler && runtime.env.WORKER_ENABLE_OUTCOME_EVALUATION;
  const scheduledTimeframes = parseTimeframes(
    runtime.env.WORKER_SCHEDULED_TIMEFRAMES,
  );
  const schedulerHandles: NodeJS.Timeout[] = [];
  const resolveScheduledAssets = () =>
    resolveScheduledAssetsByUser(runtime.env, logger);

  logger.log(
    `[worker] online with queue "${runtime.queueName}" and concurrency ${runtime.env.WORKER_CONCURRENCY}`,
  );

  if (
    (shouldEnqueueBootstrapJob || shouldEnableScheduler) &&
    runtime.env.WORKER_FALLBACK_USER_ID
  ) {
    try {
      await ensureDefaultWatchlistAssets(
        runtime.env.WORKER_FALLBACK_USER_ID,
        runtime.env.DATABASE_URL,
      );
    } catch (error) {
      logger.warn(
        `[worker] could not seed default watchlist assets: ${formatWorkerError(
          error instanceof Error ? error : new Error(String(error)),
        )}`,
      );
    }
  }

  if (shouldEnqueueBootstrapJob) {
    await enqueueWorkerJobs({
      assetsByUser: await resolveScheduledAssets(),
      jobName: marketSnapshotJobName,
      queue: runtime.analysisQueue,
      timeframes: scheduledTimeframes,
      trigger: "bootstrap",
    });
  }

  if (shouldEnableScheduler) {
    for (const timeframe of scheduledTimeframes) {
      const intervalMs =
        timeframe === "1H" ? 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
      const handle = setInterval(() => {
        void resolveScheduledAssets().then((assetsByUser) =>
          enqueueWorkerJobs({
            assetsByUser,
            jobName: marketSnapshotJobName,
            queue: runtime.analysisQueue,
            timeframes: [timeframe],
            trigger: "scheduled",
          }),
        );
      }, intervalMs);

      schedulerHandles.push(handle);
      logger.log(
        `[worker] scheduled watchlist analysis on ${timeframe} every ${intervalMs / 60_000} minute(s)`,
      );
    }
  }

  if (shouldEnableThresholdChecks) {
    const thresholdIntervalMs =
      runtime.env.WORKER_THRESHOLD_CHECK_INTERVAL_MINUTES * 60 * 1000;
    const handle = setInterval(() => {
      void resolveScheduledAssets().then((assetsByUser) =>
        enqueueWorkerJobs({
          assetsByUser,
          jobName: thresholdCheckJobName,
          queue: runtime.analysisQueue,
          timeframes: scheduledTimeframes,
          trigger: "threshold",
        }),
      );
    }, thresholdIntervalMs);

    schedulerHandles.push(handle);
    logger.log(
      `[worker] scheduled lightweight threshold checks on ${scheduledTimeframes.join(", ")} every ${runtime.env.WORKER_THRESHOLD_CHECK_INTERVAL_MINUTES} minute(s)`,
    );
  }

  if (shouldEnableOutcomeEvaluation) {
    const outcomeIntervalMs = 60 * 60 * 1000;
    const handle = setInterval(() => {
      void resolveScheduledAssets().then((assetsByUser) =>
        enqueueWorkerJobs({
          assetsByUser,
          jobName: outcomeEvaluationJobName,
          queue: runtime.analysisQueue,
          timeframes: scheduledTimeframes,
          trigger: "scheduled",
        }),
      );
    }, outcomeIntervalMs);

    schedulerHandles.push(handle);
    logger.log(
      `[worker] scheduled analysis outcome evaluation on ${scheduledTimeframes.join(", ")} every 60 minute(s)`,
    );
  }

  const originalShutdown = runtime.shutdown;
  runtime.shutdown = async () => {
    for (const handle of schedulerHandles) {
      clearInterval(handle);
    }

    await originalShutdown();
  };

  return runtime;
}

export type ScheduledUserAssets = {
  assetIds: string[];
  userId: string;
};

async function resolveScheduledAssetsForUser(
  userId: string,
  env: WorkerEnv,
  logger: Logger,
): Promise<string[]> {
  const entries = await listWatchlistAssets(userId, env.DATABASE_URL);
  const aiEnabled = entries
    .filter((entry) => entry.aiEnabled)
    .sort((left, right) => {
      if (left.source === "position" && right.source !== "position") {
        return -1;
      }

      if (left.source !== "position" && right.source === "position") {
        return 1;
      }

      return 0;
    })
    .map((entry) => entry.asset.id);

  if (aiEnabled.length > env.WORKER_MAX_AI_ASSETS) {
    logger.warn(
      `[worker] user ${userId} has ${aiEnabled.length} AI-enabled asset(s); scheduling only the first ${env.WORKER_MAX_AI_ASSETS} to control AI cost`,
    );
  }

  return aiEnabled.slice(0, env.WORKER_MAX_AI_ASSETS);
}

async function resolveScheduledAssetsByUser(
  env: WorkerEnv,
  logger: Logger,
): Promise<ScheduledUserAssets[]> {
  try {
    const userIds = await listAllWatchlistUserIds(env.DATABASE_URL);

    if (userIds.length === 0) {
      throw new Error("No users have a watchlist yet.");
    }

    const assetsByUser = await Promise.all(
      userIds.map(async (userId) => ({
        assetIds: await resolveScheduledAssetsForUser(userId, env, logger),
        userId,
      })),
    );

    return assetsByUser.filter((entry) => entry.assetIds.length > 0);
  } catch (error) {
    logger.warn(
      `[worker] could not read watchlists from the database, falling back to WORKER_SCHEDULED_ASSETS: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    if (!env.WORKER_FALLBACK_USER_ID) {
      logger.warn(
        "[worker] WORKER_FALLBACK_USER_ID is not configured; skipping the fallback schedule.",
      );
      return [];
    }

    return [
      {
        assetIds: parseCsvList(env.WORKER_SCHEDULED_ASSETS),
        userId: env.WORKER_FALLBACK_USER_ID,
      },
    ];
  }
}

async function enqueueWorkerJobs({
  assetsByUser,
  jobName,
  queue,
  timeframes,
  trigger,
}: {
  assetsByUser: ScheduledUserAssets[];
  jobName: string;
  queue: Queue<MarketSnapshotJobData>;
  timeframes: MarketSnapshotJobData["timeframe"][];
  trigger: MarketSnapshotJobData["trigger"];
}) {
  const requestedAt = new Date().toISOString();

  await Promise.all(
    assetsByUser.flatMap(({ assetIds, userId }) =>
      assetIds.flatMap((assetId) =>
        timeframes.map((timeframe) =>
          queue.add(jobName, {
            assetId,
            requestedAt,
            timeframe,
            trigger,
            userId,
          }),
        ),
      ),
    ),
  );
}

function parseCsvList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseTimeframes(
  value: string,
): Array<MarketSnapshotJobData["timeframe"]> {
  return parseCsvList(value).filter(
    (entry): entry is MarketSnapshotJobData["timeframe"] =>
      entry === "1H" || entry === "4H",
  );
}

function resolveAnalysisTrigger(trigger: WorkerJobTrigger): AnalysisTrigger {
  switch (trigger) {
    case "bootstrap":
    case "scheduled":
      return "scheduled";
    case "manual":
      return "manual_recalculation";
    case "threshold":
      return "realtime_event";
  }
}
