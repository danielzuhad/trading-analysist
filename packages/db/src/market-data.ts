import type {
  MarketCandleSeries,
  MarketSnapshot,
} from "@trading-analyst/shared-types";
import {
  marketCandleSeriesSchema,
  marketSnapshotSchema,
} from "@trading-analyst/shared-types";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { marketLatestSnapshots } from "./schema/index.js";

export type LatestMarketData = {
  series: MarketCandleSeries;
  snapshot: MarketSnapshot;
};

type StoredLatestMarketDataRow = typeof marketLatestSnapshots.$inferSelect;
type StoredLatestMarketDataInsert = typeof marketLatestSnapshots.$inferInsert;

export function serializeLatestMarketData({
  series,
  snapshot,
}: LatestMarketData): StoredLatestMarketDataInsert {
  return {
    id: snapshot.id,
    assetId: snapshot.assetId,
    provider: snapshot.provider,
    timeframe: snapshot.timeframe,
    capturedAt: new Date(snapshot.capturedAt),
    lastPrice: serializeNumber(snapshot.lastPrice),
    bidPrice: serializeOptionalNumber(snapshot.bidPrice),
    askPrice: serializeOptionalNumber(snapshot.askPrice),
    candle: snapshot.candle,
    candles: series.candles,
    marketSession: snapshot.marketSession,
    priceChangePercent: serializeOptionalNumber(snapshot.priceChangePercent),
    volumeWeightedAveragePrice: serializeOptionalNumber(
      snapshot.volumeWeightedAveragePrice,
    ),
    quoteCurrency: snapshot.quoteCurrency,
    baseCurrency: snapshot.baseCurrency,
    eventFlags: snapshot.eventFlags,
    metadata: snapshot.metadata,
  };
}

export function parseLatestMarketData(
  row: StoredLatestMarketDataRow,
): LatestMarketData {
  const snapshot = marketSnapshotSchema.parse({
    id: row.id,
    assetId: row.assetId,
    provider: row.provider,
    timeframe: row.timeframe,
    capturedAt: row.capturedAt.toISOString(),
    lastPrice: parseNumber(row.lastPrice),
    bidPrice: parseOptionalNumber(row.bidPrice),
    askPrice: parseOptionalNumber(row.askPrice),
    candle: row.candle,
    marketSession: row.marketSession,
    priceChangePercent: parseOptionalNumber(row.priceChangePercent),
    volumeWeightedAveragePrice: parseOptionalNumber(
      row.volumeWeightedAveragePrice,
    ),
    quoteCurrency: row.quoteCurrency ?? undefined,
    baseCurrency: row.baseCurrency ?? undefined,
    eventFlags: row.eventFlags,
    metadata: row.metadata,
  });

  const series = marketCandleSeriesSchema.parse({
    assetId: row.assetId,
    provider: row.provider,
    timeframe: row.timeframe,
    capturedAt: row.capturedAt.toISOString(),
    lastPrice: parseNumber(row.lastPrice),
    bidPrice: parseOptionalNumber(row.bidPrice),
    askPrice: parseOptionalNumber(row.askPrice),
    candles: row.candles,
    marketSession: row.marketSession,
    priceChangePercent: parseOptionalNumber(row.priceChangePercent),
    volumeWeightedAveragePrice: parseOptionalNumber(
      row.volumeWeightedAveragePrice,
    ),
    quoteCurrency: row.quoteCurrency ?? undefined,
    baseCurrency: row.baseCurrency ?? undefined,
    eventFlags: row.eventFlags,
    metadata: row.metadata,
  });

  return {
    series,
    snapshot,
  };
}

export async function saveLatestMarketData(
  data: LatestMarketData,
  connectionString?: string,
) {
  const values = serializeLatestMarketData(data);
  const db = getDb(connectionString);

  await db
    .insert(marketLatestSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: marketLatestSnapshots.id,
      set: {
        ...values,
        updatedAt: sql`now()`,
      },
    });

  return data;
}

export async function getLatestMarketData(
  assetId: string,
  timeframe: MarketSnapshot["timeframe"],
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const row = await db.query.marketLatestSnapshots.findFirst({
    where: and(
      eq(marketLatestSnapshots.assetId, assetId),
      eq(marketLatestSnapshots.timeframe, timeframe),
    ),
  });

  return row ? parseLatestMarketData(row) : null;
}

export async function listLatestMarketData(connectionString?: string) {
  const db = getDb(connectionString);
  const rows = await db.query.marketLatestSnapshots.findMany();

  return rows.map(parseLatestMarketData);
}

function serializeNumber(value: number) {
  return value.toString();
}

function serializeOptionalNumber(value?: number) {
  return value === undefined ? null : serializeNumber(value);
}

function parseNumber(value: string) {
  return Number(value);
}

function parseOptionalNumber(value: string | null) {
  return value === null ? undefined : parseNumber(value);
}
