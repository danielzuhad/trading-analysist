import { closeDatabase, pingDatabase } from "@trading-analyst/db";
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
    checkDatabase: () => pingDatabase(env.DATABASE_URL),
    redis,
  });

  app.addHook("onClose", async () => {
    await redis.quit().catch(() => undefined);
    await closeDatabase(env.DATABASE_URL);
  });

  return app;
}
