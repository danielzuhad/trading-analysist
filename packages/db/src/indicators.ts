import type { IndicatorSnapshot } from "@trading-analyst/shared-types";
import { indicatorSnapshotSchema } from "@trading-analyst/shared-types";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { indicatorLatestSnapshots } from "./schema/index.js";

type StoredLatestIndicatorSnapshotRow =
  typeof indicatorLatestSnapshots.$inferSelect;
type StoredLatestIndicatorSnapshotInsert =
  typeof indicatorLatestSnapshots.$inferInsert;

export function serializeLatestIndicatorSnapshot(
  snapshot: IndicatorSnapshot,
): StoredLatestIndicatorSnapshotInsert {
  return {
    id: snapshot.id,
    assetId: snapshot.assetId,
    timeframe: snapshot.timeframe,
    calculatedAt: new Date(snapshot.calculatedAt),
    movingAverages: snapshot.movingAverages,
    oscillators: snapshot.oscillators,
    volatility: snapshot.volatility,
    volume: snapshot.volume,
    levels: snapshot.levels,
    structure: snapshot.structure,
    metadata: snapshot.metadata,
  };
}

export function parseLatestIndicatorSnapshot(
  row: StoredLatestIndicatorSnapshotRow,
): IndicatorSnapshot {
  return indicatorSnapshotSchema.parse({
    id: row.id,
    assetId: row.assetId,
    timeframe: row.timeframe,
    calculatedAt: row.calculatedAt.toISOString(),
    movingAverages: row.movingAverages,
    oscillators: row.oscillators,
    volatility: row.volatility,
    volume: row.volume,
    levels: row.levels,
    structure: row.structure,
    metadata: row.metadata,
  });
}

export async function saveLatestIndicatorSnapshot(
  snapshot: IndicatorSnapshot,
  connectionString?: string,
) {
  const values = serializeLatestIndicatorSnapshot(snapshot);
  const db = getDb(connectionString);

  await db
    .insert(indicatorLatestSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: indicatorLatestSnapshots.id,
      set: {
        ...values,
        updatedAt: sql`now()`,
      },
    });

  return snapshot;
}

export async function getLatestIndicatorSnapshot(
  assetId: string,
  timeframe: IndicatorSnapshot["timeframe"],
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const row = await db.query.indicatorLatestSnapshots.findFirst({
    where: and(
      eq(indicatorLatestSnapshots.assetId, assetId),
      eq(indicatorLatestSnapshots.timeframe, timeframe),
    ),
  });

  return row ? parseLatestIndicatorSnapshot(row) : null;
}

export async function listLatestIndicatorSnapshots(connectionString?: string) {
  const db = getDb(connectionString);
  const rows = await db.query.indicatorLatestSnapshots.findMany();

  return rows.map(parseLatestIndicatorSnapshot);
}
