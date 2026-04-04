import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MarketSnapshotJobData } from "../src/queues.js";
import { marketSnapshotJobName } from "../src/queues.js";
import { startWorkerRuntime, type WorkerRuntime } from "../src/runtime.js";

const runInfrastructureTests = process.env.RUN_INFRA_TESTS === "true";
const describeInfrastructure = runInfrastructureTests
  ? describe
  : describe.skip;
const redisUrl = process.env.REDIS_URL;
const requireRedisUrl = () => {
  if (!redisUrl) {
    throw new Error("REDIS_URL is required when RUN_INFRA_TESTS=true.");
  }

  return redisUrl;
};

if (runInfrastructureTests && !redisUrl) {
  throw new Error("REDIS_URL is required when RUN_INFRA_TESTS=true.");
}

describeInfrastructure("worker bootstrap", () => {
  let processedJob: MarketSnapshotJobData | undefined;
  let processedJobPromise: Promise<void>;
  let queueName: string;
  let runtime: WorkerRuntime;
  let resolveProcessedJob: (() => void) | undefined;

  beforeAll(async () => {
    queueName = `analysis-test-${randomUUID()}`;
    processedJobPromise = new Promise<void>((resolve) => {
      resolveProcessedJob = resolve;
    });

    runtime = await startWorkerRuntime({
      env: {
        DATABASE_URL: "https://database.invalid",
        NODE_ENV: "test",
        REDIS_URL: requireRedisUrl(),
        TWELVE_DATA_API_KEY: "test-key",
        WORKER_CONCURRENCY: 1,
      },
      enqueueBootstrapJob: false,
      logger: {
        error: console.error,
        log: console.log,
        warn: console.warn,
      },
      queueName,
      processor: async (job) => {
        processedJob = job.data;
        resolveProcessedJob?.();
      },
    });

    await runtime.worker.waitUntilReady();
    await runtime.analysisQueue.waitUntilReady();
  });

  afterAll(async () => {
    await runtime.shutdown();
  });

  it("connects to Redis and processes analysis jobs", async () => {
    await runtime.analysisQueue.add(marketSnapshotJobName, {
      assetId: "crypto:global:BTC-USD",
      requestedAt: new Date().toISOString(),
      timeframe: "1H",
      trigger: "manual",
    });

    await processedJobPromise;

    expect(processedJob).toMatchObject({
      assetId: "crypto:global:BTC-USD",
      timeframe: "1H",
      trigger: "manual",
    });
    expect(processedJob?.requestedAt).toEqual(expect.any(String));
  });
});
