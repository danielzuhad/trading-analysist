import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AnalysisJobData } from "../src/queues.js";
import { startWorkerRuntime, type WorkerRuntime } from "../src/runtime.js";

const runInfrastructureTests = process.env.RUN_INFRA_TESTS === "true";
const describeInfrastructure = runInfrastructureTests
  ? describe
  : describe.skip;

describeInfrastructure("worker bootstrap", () => {
  let processedJob: AnalysisJobData | undefined;
  let runtime: WorkerRuntime;
  let resolveProcessedJob: (() => void) | undefined;
  const processedJobPromise = new Promise<void>((resolve) => {
    resolveProcessedJob = resolve;
  });

  beforeAll(async () => {
    runtime = await startWorkerRuntime({
      env: {
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
        WORKER_CONCURRENCY: 1,
      },
      enqueueBootstrapJob: false,
      logger: {
        error: console.error,
        log: console.log,
      },
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
