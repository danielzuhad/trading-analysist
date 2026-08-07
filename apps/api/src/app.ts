import rateLimit from "@fastify/rate-limit";
import {
  addWatchlistAsset,
  closeDatabase,
  closePosition,
  createApiToken,
  createPosition,
  createUser,
  ensureDefaultWatchlistAssets,
  getActivePositionForAsset,
  getAnalysisQualitySummary,
  getLatestAssetAnalysis,
  getLatestIndicatorSnapshot,
  getLatestMarketData,
  getLatestSignalAggregationSnapshot,
  getUserById,
  getWatchlistAsset,
  getWatchlistAssetBySymbol,
  listAlerts,
  listAnalysisOutcomes,
  listPositions,
  listServiceHeartbeats,
  listUsers,
  listWatchlistAssets,
  pingDatabase,
  removeWatchlistAsset,
  resolveAlert,
  resolveApiToken,
  revokeApiToken,
  setWatchlistAssetAiEnabled,
  setWatchlistAssetAlertsMutedUntil,
  updatePosition,
  verifyUserPassword,
} from "@trading-analyst/db";
import { searchCoinGeckoCoins } from "@trading-analyst/market-data";
import {
  analysisQueueName,
  type MarketSnapshotJobData,
  marketSnapshotJobName,
} from "@trading-analyst/shared-types";
import { Queue } from "bullmq";
import Fastify from "fastify";
import { Redis } from "ioredis";
import { registerAuthGuard } from "./auth.js";
import { registerCors } from "./cors.js";
import { type ApiEnv, loadApiEnv } from "./env.js";
import { registerAlertRoutes } from "./routes/alerts.js";
import { registerAnalysisRoutes } from "./routes/analysis.js";
import { registerAnalysisQualityRoutes } from "./routes/analysis-quality.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerChatLayerRoutes } from "./routes/chat-layer.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMarketDataRoutes } from "./routes/market-data.js";
import { registerPortfolioRoutes } from "./routes/portfolio.js";
import { registerPositionRoutes } from "./routes/positions.js";
import { registerWatchlistRoutes } from "./routes/watchlist.js";

export async function buildApp(env: ApiEnv = loadApiEnv()) {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  // Producer-only view of the worker's queue. BullMQ needs its own connection
  // settings (maxRetriesPerRequest: null), so it cannot share the health-check
  // client above.
  const analysisQueue = new Queue<MarketSnapshotJobData>(analysisQueueName, {
    connection: { url: env.REDIS_URL },
  });

  app.addContentTypeParser(
    /^application\/x-www-form-urlencoded(?:;.*)?$/u,
    {
      parseAs: "string",
    },
    (_request, body, done) => {
      done(null, body);
    },
  );

  await registerCors(app);
  await app.register(rateLimit, { global: false });
  registerAuthGuard(app, {
    ...(env.API_AUTH_TOKEN ? { bootstrapToken: env.API_AUTH_TOKEN } : {}),
    ...(env.BOOTSTRAP_ADMIN_USER_ID
      ? { bootstrapUserId: env.BOOTSTRAP_ADMIN_USER_ID }
      : {}),
    enabled: Boolean(env.API_AUTH_TOKEN),
    getUserById: (userId) => getUserById(userId, env.DATABASE_URL),
    resolveApiToken: (token) => resolveApiToken(token, env.DATABASE_URL),
  });
  await registerAuthRoutes(app, {
    createApiToken: (userId) => createApiToken(userId, env.DATABASE_URL),
    createUser: (input) => createUser(input, env.DATABASE_URL),
    listUsers: () => listUsers(env.DATABASE_URL),
    revokeApiToken: (tokenId) => revokeApiToken(tokenId, env.DATABASE_URL),
    verifyUserPassword: (email, password) =>
      verifyUserPassword(email, password, env.DATABASE_URL),
  });
  await registerHealthRoutes(app, {
    env,
    checkDatabase: () => pingDatabase(env.DATABASE_URL),
    listOperationalHeartbeats: () => listServiceHeartbeats(env.DATABASE_URL),
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
  await registerDashboardRoutes(app, {
    getLatestAssetAnalysis: (assetId, timeframe) =>
      getLatestAssetAnalysis(assetId, timeframe, env.DATABASE_URL),
    getLatestIndicatorSnapshot: (assetId, timeframe) =>
      getLatestIndicatorSnapshot(assetId, timeframe, env.DATABASE_URL),
    getLatestMarketData: (assetId, timeframe) =>
      getLatestMarketData(assetId, timeframe, env.DATABASE_URL),
    getLatestSignalAggregationSnapshot: (assetId, timeframe) =>
      getLatestSignalAggregationSnapshot(assetId, timeframe, env.DATABASE_URL),
    getActivePositionForAsset: ({ assetId, userId }) =>
      getActivePositionForAsset({
        assetId,
        connectionString: env.DATABASE_URL,
        userId,
      }),
    getWatchlistAsset: ({ assetId, userId }) =>
      getWatchlistAsset({ assetId, userId }, env.DATABASE_URL),
    listWatchlistAssets: (userId) =>
      listWatchlistAssets(userId, env.DATABASE_URL),
  });
  await registerAlertRoutes(app, {
    listAlerts: (filters) => listAlerts(filters, env.DATABASE_URL),
    resolveAlert: (alertId, input) =>
      resolveAlert(alertId, input, env.DATABASE_URL),
  });
  await registerAnalysisQualityRoutes(app, {
    getAnalysisQualitySummary: (filters) =>
      getAnalysisQualitySummary(filters, env.DATABASE_URL),
    listAnalysisOutcomes: (filters) =>
      listAnalysisOutcomes(filters, env.DATABASE_URL),
  });
  await registerAnalysisRoutes(app, {
    enqueueAnalysisJob: async (data) => {
      const job = await analysisQueue.add(marketSnapshotJobName, data);

      return { jobId: job.id ?? "unknown" };
    },
    getWatchlistAsset: ({ assetId, userId }) =>
      getWatchlistAsset({ assetId, userId }, env.DATABASE_URL),
  });
  await registerWatchlistRoutes(app, {
    addAsset: (input) => addWatchlistAsset(input, env.DATABASE_URL),
    ensureDefaults: (userId) =>
      ensureDefaultWatchlistAssets(userId, env.DATABASE_URL),
    getActivePositionForAsset: ({ assetId, userId }) =>
      getActivePositionForAsset({
        assetId,
        connectionString: env.DATABASE_URL,
        userId,
      }),
    listAssets: (userId) => listWatchlistAssets(userId, env.DATABASE_URL),
    removeAsset: (filters) => removeWatchlistAsset(filters, env.DATABASE_URL),
    setAssetAiEnabled: (filters, aiEnabled) =>
      setWatchlistAssetAiEnabled(filters, aiEnabled, env.DATABASE_URL),
    setAssetAlertsMutedUntil: (filters, alertsMutedUntil) =>
      setWatchlistAssetAlertsMutedUntil(
        filters,
        alertsMutedUntil,
        env.DATABASE_URL,
      ),
    ...(env.COINGECKO_API_KEY
      ? {
          searchCoins: (query: string) =>
            searchCoinGeckoCoins({
              apiKey: env.COINGECKO_API_KEY as string,
              apiPlan: env.COINGECKO_API_PLAN,
              query,
            }),
        }
      : {}),
  });
  await registerPositionRoutes(app, {
    closePosition: (positionId, input, userId) =>
      closePosition(positionId, input, env.DATABASE_URL, userId),
    createPosition: (input) => createPosition(input, env.DATABASE_URL),
    getActivePositionForAsset: ({ assetId, userId }) =>
      getActivePositionForAsset({
        assetId,
        connectionString: env.DATABASE_URL,
        userId,
      }),
    listPositions: (filters) => listPositions(filters, env.DATABASE_URL),
    updatePosition: (positionId, input, userId) =>
      updatePosition(positionId, input, env.DATABASE_URL, userId),
  });
  await registerPortfolioRoutes(app, {
    getWatchlistAsset: ({ assetId, userId }) =>
      getWatchlistAsset({ assetId, userId }, env.DATABASE_URL),
    listPositions: (filters) => listPositions(filters, env.DATABASE_URL),
  });
  await registerChatLayerRoutes(app, {
    ...(env.TWILIO_AUTH_TOKEN ? { authToken: env.TWILIO_AUTH_TOKEN } : {}),
    chatUserId: env.CHAT_LAYER_USER_ID ?? env.BOOTSTRAP_ADMIN_USER_ID ?? "",
    closePosition: (positionId, input) =>
      closePosition(
        positionId,
        input,
        env.DATABASE_URL,
        env.CHAT_LAYER_USER_ID ?? env.BOOTSTRAP_ADMIN_USER_ID,
      ),
    createPosition: (input) => createPosition(input, env.DATABASE_URL),
    getActivePositionForAsset: ({ assetId, userId }) =>
      getActivePositionForAsset({
        assetId,
        connectionString: env.DATABASE_URL,
        userId,
      }),
    getLatestAssetAnalysis: (assetId, timeframe) =>
      getLatestAssetAnalysis(assetId, timeframe, env.DATABASE_URL),
    getLatestIndicatorSnapshot: (assetId, timeframe) =>
      getLatestIndicatorSnapshot(assetId, timeframe, env.DATABASE_URL),
    getLatestMarketData: (assetId, timeframe) =>
      getLatestMarketData(assetId, timeframe, env.DATABASE_URL),
    getLatestSignalAggregationSnapshot: (assetId, timeframe) =>
      getLatestSignalAggregationSnapshot(assetId, timeframe, env.DATABASE_URL),
    getWatchlistAssetBySymbol: ({ symbol, userId }) =>
      getWatchlistAssetBySymbol({ symbol, userId }, env.DATABASE_URL),
    listWatchlistAssets: (userId) =>
      listWatchlistAssets(userId, env.DATABASE_URL),
    ...(env.TWILIO_WEBHOOK_URL ? { webhookUrl: env.TWILIO_WEBHOOK_URL } : {}),
    ...(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET
      ? {
          telegram: {
            botToken: env.TELEGRAM_BOT_TOKEN,
            webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
            ...(env.TELEGRAM_CHAT_ID
              ? { allowedChatId: env.TELEGRAM_CHAT_ID }
              : {}),
          },
        }
      : {}),
  });

  app.addHook("onClose", async () => {
    await analysisQueue.close().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    await closeDatabase(env.DATABASE_URL);
  });

  return app;
}
