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
};

type StartWorkerRuntimeOptions = CreateWorkerRuntimeOptions & {
  enqueueBootstrapJob?: boolean;
};

export type WorkerRuntime = {
  analysisQueue: Queue<AnalysisJobData>;
  connection: Redis;
  env: WorkerEnv;
  shutdown: () => Promise<void>;
  worker: Worker<AnalysisJobData>;
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
}: CreateWorkerRuntimeOptions = {}): WorkerRuntime {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const analysisQueue = new Queue<AnalysisJobData>(analysisQueueName, {
    connection,
  });

  const worker = new Worker<AnalysisJobData>(
    analysisQueueName,
    async (job) => {
      const processJob =
        processor ?? ((currentJob) => defaultProcessor(currentJob, logger));
      await processJob(job);
    },
    {
      concurrency: env.WORKER_CONCURRENCY,
      connection,
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
    connection,
    env,
    shutdown: async () => {
      await worker.close();
      await analysisQueue.close();
      await connection.quit();
    },
    worker,
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
    `[worker] online with queue "${analysisQueueName}" and concurrency ${runtime.env.WORKER_CONCURRENCY}`,
  );

  if (shouldEnqueueBootstrapJob) {
    await runtime.analysisQueue.add("bootstrap-analysis", {
      requestedAt: new Date().toISOString(),
      trigger: "bootstrap",
    });
  }

  return runtime;
}
