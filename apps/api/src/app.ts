import { closeDatabase } from "@trading-analyst/db";
import Fastify from "fastify";
import { Redis } from "ioredis";
import { type ApiEnv, loadApiEnv } from "./env.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function buildApp(env: ApiEnv = loadApiEnv()) {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  await registerHealthRoutes(app, {
    env,
    redis,
  });

  app.addHook("onClose", async () => {
    await redis.quit().catch(() => undefined);
    await closeDatabase();
  });

  return app;
}
