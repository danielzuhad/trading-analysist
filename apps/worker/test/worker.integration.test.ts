import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AnalysisJobData } from "../src/queues.js";
import { startWorkerRuntime, type WorkerRuntime } from "../src/runtime.js";

const runInfrastructureTests = process.env.RUN_INFRA_TESTS === "true";
const describeInfrastructure = runInfrastructureTests
  ? describe
  : describe.skip;

describeInfrastructure("worker bootstrap", () => {
  let processedJob: AnalysisJobData | undefined;
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
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
        WORKER_CONCURRENCY: 1,
      },
      enqueueBootstrapJob: false,
      logger: {
        error: console.error,
        log: console.log,
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
    await runtime.analysisQueue.add("manual-analysis", {
      requestedAt: new Date().toISOString(),
      trigger: "manual",
    });

    await processedJobPromise;

    expect(processedJob).toMatchObject({
      trigger: "manual",
    });
    expect(processedJob?.requestedAt).toEqual(expect.any(String));
  });
});
