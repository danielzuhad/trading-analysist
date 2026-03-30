import { loadWorkerEnv } from "./env.js";
import { startWorkerRuntime } from "./runtime.js";

const env = loadWorkerEnv();
const runtime = await startWorkerRuntime({
  env,
});

const shutdown = async () => {
  await runtime.shutdown();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
