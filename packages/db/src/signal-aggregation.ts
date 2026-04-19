import type { SignalAggregationSnapshot } from "@trading-analyst/shared-types";
import { signalAggregationSnapshotSchema } from "@trading-analyst/shared-types";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { signalAggregationLatestSnapshots } from "./schema/index.js";

type StoredLatestSignalAggregationSnapshotRow =
  typeof signalAggregationLatestSnapshots.$inferSelect;
type StoredLatestSignalAggregationSnapshotInsert =
  typeof signalAggregationLatestSnapshots.$inferInsert;

export function serializeLatestSignalAggregationSnapshot(
  snapshot: SignalAggregationSnapshot,
): StoredLatestSignalAggregationSnapshotInsert {
  return {
    id: snapshot.id,
    assetId: snapshot.asset.id,
    timeframe: snapshot.marketSnapshot.timeframe,
    generatedAt: new Date(snapshot.generatedAt),
    asset: snapshot.asset,
    marketSnapshot: snapshot.marketSnapshot,
    indicatorSnapshot: snapshot.indicatorSnapshot,
    position: snapshot.position ?? null,
    signalStrengthScore: snapshot.signalStrengthScore,
    bias: snapshot.bias,
    regime: snapshot.regime,
    timeframeRelevance: snapshot.timeframeRelevance,
    riskFlags: snapshot.riskFlags,
    keyLevels: snapshot.keyLevels,
    labels: snapshot.labels,
    summary: snapshot.summary,
    snapshotHash: snapshot.snapshotHash,
    metadata: snapshot.metadata,
  };
}

export function parseLatestSignalAggregationSnapshot(
  row: StoredLatestSignalAggregationSnapshotRow,
): SignalAggregationSnapshot {
  return signalAggregationSnapshotSchema.parse({
    id: row.id,
    asset: row.asset,
    marketSnapshot: row.marketSnapshot,
    indicatorSnapshot: row.indicatorSnapshot,
    position: row.position ?? undefined,
    generatedAt: row.generatedAt.toISOString(),
    signalStrengthScore: row.signalStrengthScore,
    bias: row.bias,
    regime: row.regime,
    timeframeRelevance: row.timeframeRelevance,
    riskFlags: row.riskFlags,
    keyLevels: row.keyLevels,
    labels: row.labels,
    summary: row.summary,
    snapshotHash: row.snapshotHash,
    metadata: row.metadata,
  });
}

export async function saveLatestSignalAggregationSnapshot(
  snapshot: SignalAggregationSnapshot,
  connectionString?: string,
) {
  const values = serializeLatestSignalAggregationSnapshot(snapshot);
  const db = getDb(connectionString);

  await db
    .insert(signalAggregationLatestSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: signalAggregationLatestSnapshots.id,
      set: {
        ...values,
        updatedAt: sql`now()`,
      },
    });

  return snapshot;
}

export async function getLatestSignalAggregationSnapshot(
  assetId: string,
  timeframe: SignalAggregationSnapshot["marketSnapshot"]["timeframe"],
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const row = await db.query.signalAggregationLatestSnapshots.findFirst({
    where: and(
      eq(signalAggregationLatestSnapshots.assetId, assetId),
      eq(signalAggregationLatestSnapshots.timeframe, timeframe),
    ),
  });

  return row ? parseLatestSignalAggregationSnapshot(row) : null;
}

export async function listLatestSignalAggregationSnapshots(
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const rows = await db.query.signalAggregationLatestSnapshots.findMany();

  return rows.map(parseLatestSignalAggregationSnapshot);
}
