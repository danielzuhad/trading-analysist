import type { CoinGeckoSearchResult } from "@trading-analyst/market-data";
import type {
  Position,
  WatchlistAssetEntry,
  WatchlistAssetSource,
} from "@trading-analyst/shared-types";
import {
  buildCryptoAssetFromCoingecko,
  MAX_WATCHLIST_ASSETS,
} from "@trading-analyst/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const addWatchlistBodySchema = z.object({
  coingeckoCoinId: z.string().trim().min(1),
  imageUrl: z.string().url().optional(),
  name: z.string().trim().min(1),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9]+$/u),
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(64),
});

const setAiEnabledBodySchema = z.object({
  aiEnabled: z.boolean(),
});

type Dependencies = {
  addAsset: (input: {
    asset: ReturnType<typeof buildCryptoAssetFromCoingecko>;
    source: WatchlistAssetSource;
  }) => Promise<{ status: "created" | "duplicate" }>;
  ensureDefaults: () => Promise<void>;
  getActivePositionForAsset: (filters: {
    assetId: string;
  }) => Promise<Position | null>;
  listAssets: () => Promise<WatchlistAssetEntry[]>;
  removeAsset: (
    assetId: string,
  ) => Promise<{ status: "removed" | "not_found" }>;
  searchCoins?: (query: string) => Promise<CoinGeckoSearchResult[]>;
  setAssetAiEnabled: (
    assetId: string,
    aiEnabled: boolean,
  ) => Promise<{ status: "updated" | "not_found" }>;
};

export async function registerWatchlistRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/watchlist", async () => {
    await dependencies.ensureDefaults();
    const entries = await dependencies.listAssets();

    return {
      count: entries.length,
      limit: MAX_WATCHLIST_ASSETS,
      entries,
    };
  });

  app.post("/watchlist", async (request, reply) => {
    const bodyResult = addWatchlistBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      return reply.code(400).send({
        error: "INVALID_BODY",
        issues: bodyResult.error.issues,
      });
    }

    const asset = buildCryptoAssetFromCoingecko(bodyResult.data);
    const entries = await dependencies.listAssets();
    const alreadyWatched = entries.some((entry) => entry.asset.id === asset.id);

    if (!alreadyWatched && entries.length >= MAX_WATCHLIST_ASSETS) {
      return reply.code(409).send({
        error: "WATCHLIST_LIMIT_REACHED",
        limit: MAX_WATCHLIST_ASSETS,
        message: `The watchlist is limited to ${MAX_WATCHLIST_ASSETS} assets to keep AI analysis cost and market-data rate limits under control. Remove an asset before adding a new one.`,
      });
    }

    const result = await dependencies.addAsset({
      asset,
      source: "manual",
    });

    return reply.code(result.status === "created" ? 201 : 200).send({
      assetId: asset.id,
      status: result.status,
    });
  });

  app.patch("/watchlist/:assetId", async (request, reply) => {
    const { assetId } = request.params as { assetId: string };
    const bodyResult = setAiEnabledBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      return reply.code(400).send({
        error: "INVALID_BODY",
        issues: bodyResult.error.issues,
      });
    }

    const result = await dependencies.setAssetAiEnabled(
      assetId,
      bodyResult.data.aiEnabled,
    );

    if (result.status === "not_found") {
      return reply.code(404).send({
        error: "WATCHLIST_ASSET_NOT_FOUND",
        assetId,
      });
    }

    return { assetId, aiEnabled: bodyResult.data.aiEnabled, status: "updated" };
  });

  app.delete("/watchlist/:assetId", async (request, reply) => {
    const { assetId } = request.params as { assetId: string };
    const activePosition = await dependencies.getActivePositionForAsset({
      assetId,
    });

    if (activePosition) {
      return reply.code(409).send({
        error: "ASSET_HAS_ACTIVE_POSITION",
        message:
          "Close the active position for this asset before removing it from the watchlist.",
      });
    }

    const result = await dependencies.removeAsset(assetId);

    if (result.status === "not_found") {
      return reply.code(404).send({
        error: "WATCHLIST_ASSET_NOT_FOUND",
        assetId,
      });
    }

    return { assetId, status: "removed" };
  });

  app.get("/crypto-search", async (request, reply) => {
    if (!dependencies.searchCoins) {
      return reply.code(503).send({
        error: "CRYPTO_SEARCH_DISABLED",
        message: "Set COINGECKO_API_KEY on the API to enable crypto search.",
      });
    }

    const queryResult = searchQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const [coins, entries] = await Promise.all([
      dependencies.searchCoins(queryResult.data.q),
      dependencies.listAssets(),
    ]);
    const watchedCoinIds = new Set(
      entries.map((entry) => entry.asset.metadata.coingeckoCoinId),
    );

    const results = coins.map((coin) => ({
      coingeckoCoinId: coin.coingeckoCoinId,
      symbol: coin.symbol,
      name: coin.name,
      marketCapRank: coin.marketCapRank,
      ...(coin.thumb ? { thumb: coin.thumb } : {}),
      inWatchlist: watchedCoinIds.has(coin.coingeckoCoinId),
    }));

    return {
      count: results.length,
      results,
    };
  });
}
