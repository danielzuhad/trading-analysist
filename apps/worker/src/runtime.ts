import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadWorkerEnv, type WorkerEnv } from "./env.js";
import { runAnalysisCycle } from "./pipeline.js";
import {
  analysisQueueName,
  type MarketSnapshotJobData,
  marketSnapshotJobName,
} from "./queues.js";

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
  if (job.name !== marketSnapshotJobName) {
    logger.warn(`[worker] skipped unsupported job name "${job.name}"`);
    return;
  }

  const result = await runAnalysisCycle({
    assetId: job.data.assetId,
    ...(env.COINGECKO_API_KEY
      ? { coingeckoApiKey: env.COINGECKO_API_KEY }
      : {}),
    connectionString: env.DATABASE_URL,
    logger,
    maxDailyAiCostUsd: env.MAX_DAILY_AI_COST_USD,
    ...(env.OPENAI_API_KEY ? { openAiApiKey: env.OPENAI_API_KEY } : {}),
    requestedAt: job.data.requestedAt,
    timeframe: job.data.timeframe,
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
      `[worker] failed job ${job?.id ?? "unknown"}: ${error.message}`,
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
  const scheduledAssets = parseCsvList(runtime.env.WORKER_SCHEDULED_ASSETS);
  const scheduledTimeframes = parseTimeframes(
    runtime.env.WORKER_SCHEDULED_TIMEFRAMES,
  );
  const schedulerHandles: NodeJS.Timeout[] = [];

  logger.log(
    `[worker] online with queue "${runtime.queueName}" and concurrency ${runtime.env.WORKER_CONCURRENCY}`,
  );

  if (shouldEnqueueBootstrapJob) {
    await enqueueAnalysisJobs({
      assetIds: scheduledAssets,
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
        void enqueueAnalysisJobs({
          assetIds: scheduledAssets,
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

  const originalShutdown = runtime.shutdown;
  runtime.shutdown = async () => {
    for (const handle of schedulerHandles) {
      clearInterval(handle);
    }

    await originalShutdown();
  };

  return runtime;
}

async function enqueueAnalysisJobs({
  assetIds,
  queue,
  timeframes,
  trigger,
}: {
  assetIds: string[];
  queue: Queue<MarketSnapshotJobData>;
  timeframes: MarketSnapshotJobData["timeframe"][];
  trigger: MarketSnapshotJobData["trigger"];
}) {
  const requestedAt = new Date().toISOString();

  await Promise.all(
    assetIds.flatMap((assetId) =>
      timeframes.map((timeframe) =>
        queue.add(marketSnapshotJobName, {
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
