import {
  closeDatabase,
  getLatestAssetAnalysis,
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  getLatestSignalAggregationSnapshot,
  pingDatabase,
} from "@trading-analyst/db";
import Fastify from "fastify";
import { Redis } from "ioredis";
import { registerCors } from "./cors.js";
import { type ApiEnv, loadApiEnv } from "./env.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMarketDataRoutes } from "./routes/market-data.js";

export async function buildApp(env: ApiEnv = loadApiEnv()) {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  await registerCors(app);
  await registerHealthRoutes(app, {
    env,
    checkDatabase: () => pingDatabase(env.DATABASE_URL),
    redis,
  });
  await registerMarketDataRoutes(app, {
    getLatestAssetAnalysis: (assetId, timeframe) =>
      getLatestAssetAnalysis(assetId, timeframe, env.DATABASE_URL),
    getLatestIndicatorSnapshot: (assetId, timeframe) =>
      getLatestIndicatorSnapshot(assetId, timeframe, env.DATABASE_URL),
    getLatestMarketData: (assetId, timeframe) =>
      getLatestMarketData(assetId, timeframe, env.DATABASE_URL),
    getLatestSignalAggregationSnapshot: (assetId, timeframe) =>
      getLatestSignalAggregationSnapshot(assetId, timeframe, env.DATABASE_URL),
  });

  app.addHook("onClose", async () => {
    await redis.quit().catch(() => undefined);
    await closeDatabase(env.DATABASE_URL);
  });

  return app;
}
