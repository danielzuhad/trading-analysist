import type {
  Asset,
  WatchlistAssetEntry,
  WatchlistAssetSource,
} from "@trading-analyst/shared-types";
import {
  defaultCryptoWatchlistAssets,
  watchlistAssetEntrySchema,
} from "@trading-analyst/shared-types";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { watchlistAssets } from "./schema/index.js";

type StoredWatchlistAssetRow = typeof watchlistAssets.$inferSelect;

function readCoingeckoCoinId(asset: Asset) {
  const value = asset.metadata.coingeckoCoinId;

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Asset ${asset.id} is missing metadata.coingeckoCoinId, which is required for market data fetching.`,
    );
  }

  return value;
}

export function parseWatchlistAssetEntry(
  row: StoredWatchlistAssetRow,
): WatchlistAssetEntry {
  return watchlistAssetEntrySchema.parse({
    asset: row.asset,
    aiEnabled: row.aiEnabled,
    source: row.source,
    addedAt: row.addedAt.toISOString(),
    metadata: row.metadata,
  });
}

export async function addWatchlistAsset(
  {
    aiEnabled = true,
    asset,
    source,
    userId,
  }: {
    aiEnabled?: boolean;
    asset: Asset;
    source: WatchlistAssetSource;
    userId: string;
  },
  connectionString?: string,
): Promise<{ status: "created" | "duplicate" }> {
  const db = getDb(connectionString);
  const inserted = await db
    .insert(watchlistAssets)
    .values({
      assetId: asset.id,
      symbol: asset.symbol.toUpperCase(),
      coingeckoCoinId: readCoingeckoCoinId(asset),
      asset,
      aiEnabled,
      source,
      userId,
      metadata: {},
    })
    .onConflictDoNothing({
      target: [watchlistAssets.userId, watchlistAssets.assetId],
    })
    .returning({ assetId: watchlistAssets.assetId });

  return { status: inserted.length > 0 ? "created" : "duplicate" };
}

export async function removeWatchlistAsset(
  { assetId, userId }: { assetId: string; userId: string },
  connectionString?: string,
): Promise<{ status: "removed" | "not_found" }> {
  const db = getDb(connectionString);
  const removed = await db
    .delete(watchlistAssets)
    .where(
      and(
        eq(watchlistAssets.userId, userId),
        eq(watchlistAssets.assetId, assetId),
      ),
    )
    .returning({ assetId: watchlistAssets.assetId });

  return { status: removed.length > 0 ? "removed" : "not_found" };
}

export async function listWatchlistAssets(
  userId: string,
  connectionString?: string,
): Promise<WatchlistAssetEntry[]> {
  const db = getDb(connectionString);
  const rows = await db.query.watchlistAssets.findMany({
    where: eq(watchlistAssets.userId, userId),
    orderBy: (table, { asc }) => [asc(table.addedAt)],
  });

  return rows.map(parseWatchlistAssetEntry);
}

export async function listAllWatchlistUserIds(
  connectionString?: string,
): Promise<string[]> {
  const db = getDb(connectionString);
  const rows = await db
    .selectDistinct({ userId: watchlistAssets.userId })
    .from(watchlistAssets);

  return rows.map((row) => row.userId);
}

export async function getWatchlistAsset(
  { assetId, userId }: { assetId: string; userId: string },
  connectionString?: string,
): Promise<WatchlistAssetEntry | null> {
  const db = getDb(connectionString);
  const row = await db.query.watchlistAssets.findFirst({
    where: and(
      eq(watchlistAssets.userId, userId),
      eq(watchlistAssets.assetId, assetId),
    ),
  });

  return row ? parseWatchlistAssetEntry(row) : null;
}

export async function getWatchlistAssetBySymbol(
  { symbol, userId }: { symbol: string; userId: string },
  connectionString?: string,
): Promise<WatchlistAssetEntry | null> {
  const db = getDb(connectionString);
  const row = await db.query.watchlistAssets.findFirst({
    where: and(
      eq(watchlistAssets.userId, userId),
      eq(watchlistAssets.symbol, symbol.trim().toUpperCase()),
    ),
  });

  return row ? parseWatchlistAssetEntry(row) : null;
}

export async function setWatchlistAssetAiEnabled(
  { assetId, userId }: { assetId: string; userId: string },
  aiEnabled: boolean,
  connectionString?: string,
): Promise<{ status: "updated" | "not_found" }> {
  const db = getDb(connectionString);
  const updated = await db
    .update(watchlistAssets)
    .set({ aiEnabled, updatedAt: sql`now()` })
    .where(
      and(
        eq(watchlistAssets.userId, userId),
        eq(watchlistAssets.assetId, assetId),
      ),
    )
    .returning({ assetId: watchlistAssets.assetId });

  return { status: updated.length > 0 ? "updated" : "not_found" };
}

export async function ensureDefaultWatchlistAssets(
  userId: string,
  connectionString?: string,
): Promise<void> {
  const db = getDb(connectionString);

  for (const asset of defaultCryptoWatchlistAssets) {
    await db
      .insert(watchlistAssets)
      .values({
        assetId: asset.id,
        symbol: asset.symbol.toUpperCase(),
        coingeckoCoinId: readCoingeckoCoinId(asset),
        asset,
        aiEnabled: true,
        source: "seed",
        userId,
        metadata: {},
      })
      .onConflictDoUpdate({
        target: [watchlistAssets.userId, watchlistAssets.assetId],
        set: {
          asset,
          coingeckoCoinId: readCoingeckoCoinId(asset),
          symbol: asset.symbol.toUpperCase(),
          updatedAt: sql`now()`,
        },
      });
  }
}

export type { WatchlistAssetEntry } from "@trading-analyst/shared-types";
