import type { AnalysisTrigger } from "@trading-analyst/shared-types";
import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadWorkerEnv, type WorkerEnv } from "./env.js";
import { runAnalysisCycle } from "./pipeline.js";
import {
  analysisQueueName,
  type MarketSnapshotJobData,
  marketSnapshotJobName,
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

async function defaultProcessor(
  job: Job<MarketSnapshotJobData>,
  env: WorkerEnv,
  logger: Logger,
) {
  if (job.name === marketSnapshotJobName) {
    const result = await runAnalysisCycle({
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
      timeframe: job.data.timeframe,
      triggeredBy: resolveAnalysisTrigger(job.data.trigger),
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

  if (job.name === thresholdCheckJobName) {
    const thresholdResult = await processThresholdCheckJob({
      ...(env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {}),
      apiPlan: env.COINGECKO_API_PLAN,
      assetId: job.data.assetId,
      connectionString: env.DATABASE_URL,
      requestedAt: job.data.requestedAt,
      timeframe: job.data.timeframe,
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

    const result = await runAnalysisCycle({
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
      timeframe: job.data.timeframe,
      triggeredBy: "realtime_event",
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
  const scheduledAssets = parseCsvList(runtime.env.WORKER_SCHEDULED_ASSETS);
  const scheduledTimeframes = parseTimeframes(
    runtime.env.WORKER_SCHEDULED_TIMEFRAMES,
  );
  const schedulerHandles: NodeJS.Timeout[] = [];

  logger.log(
    `[worker] online with queue "${runtime.queueName}" and concurrency ${runtime.env.WORKER_CONCURRENCY}`,
  );

  if (shouldEnqueueBootstrapJob) {
    await enqueueWorkerJobs({
      assetIds: scheduledAssets,
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
        void enqueueWorkerJobs({
          assetIds: scheduledAssets,
          jobName: marketSnapshotJobName,
          queue: runtime.analysisQueue,
          timeframes: [timeframe],
          trigger: "scheduled",
        });
      }, intervalMs);

      schedulerHandles.push(handle);
      logger.log(
        `[worker] scheduled ${scheduledAssets.length} asset(s) on ${timeframe} every ${intervalMs / 60_000} minute(s)`,
      );
    }
  }

  if (shouldEnableThresholdChecks) {
    const thresholdIntervalMs =
      runtime.env.WORKER_THRESHOLD_CHECK_INTERVAL_MINUTES * 60 * 1000;
    const handle = setInterval(() => {
      void enqueueWorkerJobs({
        assetIds: scheduledAssets,
        jobName: thresholdCheckJobName,
        queue: runtime.analysisQueue,
        timeframes: scheduledTimeframes,
        trigger: "threshold",
      });
    }, thresholdIntervalMs);

    schedulerHandles.push(handle);
    logger.log(
      `[worker] scheduled lightweight threshold checks for ${scheduledAssets.length} asset(s) on ${scheduledTimeframes.join(", ")} every ${runtime.env.WORKER_THRESHOLD_CHECK_INTERVAL_MINUTES} minute(s)`,
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

async function enqueueWorkerJobs({
  assetIds,
  jobName,
  queue,
  timeframes,
  trigger,
}: {
  assetIds: string[];
  jobName: string;
  queue: Queue<MarketSnapshotJobData>;
  timeframes: MarketSnapshotJobData["timeframe"][];
  trigger: MarketSnapshotJobData["trigger"];
}) {
  const requestedAt = new Date().toISOString();

  await Promise.all(
    assetIds.flatMap((assetId) =>
      timeframes.map((timeframe) =>
        queue.add(jobName, {
          assetId,
          requestedAt,
          timeframe,
          trigger,
        }),
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
