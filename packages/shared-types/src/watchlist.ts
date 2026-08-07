import { z } from "zod";
import { assetSchema } from "./asset.js";
import {
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
} from "./common.js";
import {
  notificationChannelSchema,
  riskProfileSchema,
  supportedTimeframeSchema,
  tradingStyleSchema,
  watchlistStatusSchema,
} from "./primitives.js";

export const userWatchlistSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: nonEmptyStringSchema,
  description: nonEmptyStringSchema.optional(),
  assetIds: z.array(idSchema),
  priorityAssetIds: z.array(idSchema).default([]),
  mutedAssetIds: z.array(idSchema).default([]),
  tradingStyle: tradingStyleSchema,
  riskProfile: riskProfileSchema,
  timeframes: z.array(supportedTimeframeSchema).min(1),
  notificationChannels: z.array(notificationChannelSchema).min(1),
  status: watchlistStatusSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  metadata: metadataSchema,
});

export type UserWatchlist = z.infer<typeof userWatchlistSchema>;

export const watchlistAssetSourceValues = [
  "seed",
  "manual",
  "position",
] as const;
export const watchlistAssetSourceSchema = z.enum(watchlistAssetSourceValues);
export type WatchlistAssetSource = z.infer<typeof watchlistAssetSourceSchema>;

/**
 * Hard cap on watchlist size. Each watched asset costs AI analysis calls
 * every 4H cycle plus threshold-triggered re-analysis, and CoinGecko demo
 * rate limits are shared across all assets. Keep aligned with the worker's
 * WORKER_MAX_AI_ASSETS default so every watched asset actually gets analyzed.
 */
export const MAX_WATCHLIST_ASSETS = 10;

export const watchlistAssetEntrySchema = z.object({
  asset: assetSchema,
  aiEnabled: z.boolean(),
  alertsMutedUntil: isoDatetimeSchema.optional(),
  source: watchlistAssetSourceSchema,
  addedAt: isoDatetimeSchema,
  metadata: metadataSchema,
});
export type WatchlistAssetEntry = z.infer<typeof watchlistAssetEntrySchema>;

/**
 * Muting silences outbound delivery (Telegram/WhatsApp) only — the alert is
 * still generated and still appears in the dashboard feed. The dashboard is
 * a record, not a notification; muting the record would lose history.
 */
export function isAlertsMuted(
  entry: Pick<WatchlistAssetEntry, "alertsMutedUntil">,
  now: Date = new Date(),
): boolean {
  if (!entry.alertsMutedUntil) {
    return false;
  }

  return new Date(entry.alertsMutedUntil).getTime() > now.getTime();
}

export const watchlistResponseSchema = z.object({
  count: z.number().int().min(0),
  limit: z.number().int().positive(),
  entries: z.array(watchlistAssetEntrySchema),
});
export type WatchlistResponse = z.infer<typeof watchlistResponseSchema>;

export const cryptoSearchResultSchema = z.object({
  coingeckoCoinId: nonEmptyStringSchema,
  symbol: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  marketCapRank: z.number().int().positive().nullable(),
  thumb: z.string().optional(),
  inWatchlist: z.boolean(),
});
export type CryptoSearchResult = z.infer<typeof cryptoSearchResultSchema>;

export const cryptoSearchResponseSchema = z.object({
  count: z.number().int().min(0),
  results: z.array(cryptoSearchResultSchema),
});
export type CryptoSearchResponse = z.infer<typeof cryptoSearchResponseSchema>;

export function buildCryptoAssetFromCoingecko({
  coingeckoCoinId,
  imageUrl,
  name,
  symbol,
}: {
  coingeckoCoinId: string;
  imageUrl?: string | undefined;
  name: string;
  symbol: string;
}) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  return assetSchema.parse({
    id: `crypto:global:${normalizedSymbol}-USD`,
    symbol: normalizedSymbol,
    displaySymbol: `${normalizedSymbol}/USD`,
    name: name.trim(),
    assetClass: "crypto",
    market: "global",
    exchange: "global",
    instrumentType: "spot",
    baseCurrency: normalizedSymbol,
    quoteCurrency: "USD",
    providerSymbol: `${normalizedSymbol}/USD`,
    isActive: true,
    metadata: {
      coingeckoCoinId,
      ...(imageUrl ? { imageUrl } : {}),
    },
  });
}
