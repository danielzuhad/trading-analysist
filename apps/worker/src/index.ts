import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadWorkerEnv } from "./env.js";
import { type AnalysisJobData, analysisQueueName } from "./queues.js";

const env = loadWorkerEnv();

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const analysisQueue = new Queue<AnalysisJobData>(analysisQueueName, {
  connection,
});

const worker = new Worker<AnalysisJobData>(
  analysisQueueName,
  async (job) => {
    console.log(
      `[worker] processed ${job.name} from ${job.data.trigger} at ${job.data.requestedAt}`,
    );
  },
  {
    concurrency: env.WORKER_CONCURRENCY,
    connection,
  },
);

worker.on("completed", (job) => {
  console.log(`[worker] completed job ${job.id ?? "unknown"}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `[worker] failed job ${job?.id ?? "unknown"}: ${error.message}`,
  );
});

console.log(
  `[worker] online with queue "${analysisQueueName}" and concurrency ${env.WORKER_CONCURRENCY}`,
);

if (env.NODE_ENV !== "production") {
  await analysisQueue.add("bootstrap-analysis", {
    requestedAt: new Date().toISOString(),
    trigger: "bootstrap",
  });
}

const shutdown = async () => {
  await worker.close();
  await analysisQueue.close();
  await connection.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
