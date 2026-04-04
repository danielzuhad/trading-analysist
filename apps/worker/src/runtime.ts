import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadWorkerEnv, type WorkerEnv } from "./env.js";
import { processMarketSnapshotJob } from "./market-data.js";
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

  const result = await processMarketSnapshotJob({
    assetId: job.data.assetId,
    connectionString: env.DATABASE_URL,
    logger,
    requestedAt: job.data.requestedAt,
    timeframe: job.data.timeframe,
    ...(env.TWELVE_DATA_API_KEY ? { apiKey: env.TWELVE_DATA_API_KEY } : {}),
  });

  if (result.status === "skipped") {
    logger.warn(
      `[worker] market snapshot job skipped for ${result.assetId}: ${result.reason}`,
    );
  }
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

  logger.log(
    `[worker] online with queue "${runtime.queueName}" and concurrency ${runtime.env.WORKER_CONCURRENCY}`,
  );

  if (shouldEnqueueBootstrapJob) {
    await runtime.analysisQueue.add(marketSnapshotJobName, {
      assetId: "crypto:global:BTC-USD",
      requestedAt: new Date().toISOString(),
      timeframe: "1H",
      trigger: "bootstrap",
    });
  }

  return runtime;
}
