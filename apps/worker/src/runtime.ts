import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadWorkerEnv, type WorkerEnv } from "./env.js";
import { type AnalysisJobData, analysisQueueName } from "./queues.js";

type Logger = Pick<typeof console, "error" | "log">;

export type AnalysisJobProcessor = (
  job: Job<AnalysisJobData>,
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
  analysisQueue: Queue<AnalysisJobData>;
  env: WorkerEnv;
  queueName: string;
  queueConnection: Redis;
  shutdown: () => Promise<void>;
  worker: Worker<AnalysisJobData>;
  workerConnection: Redis;
};

async function defaultProcessor(job: Job<AnalysisJobData>, logger: Logger) {
  logger.log(
    `[worker] processed ${job.name} from ${job.data.trigger} at ${job.data.requestedAt}`,
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

  const analysisQueue = new Queue<AnalysisJobData>(queueName, {
    connection: queueConnection,
  });

  const worker = new Worker<AnalysisJobData>(
    queueName,
    async (job) => {
      const processJob =
        processor ?? ((currentJob) => defaultProcessor(currentJob, logger));
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
    await runtime.analysisQueue.add("bootstrap-analysis", {
      requestedAt: new Date().toISOString(),
      trigger: "bootstrap",
    });
  }

  return runtime;
}
