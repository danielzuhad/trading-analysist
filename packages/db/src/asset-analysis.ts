import type { LatestAssetAnalysis } from "@trading-analyst/shared-types";
import { latestAssetAnalysisSchema } from "@trading-analyst/shared-types";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { assetAnalysisLatestSnapshots } from "./schema/index.js";

type StoredLatestAssetAnalysisRow =
  typeof assetAnalysisLatestSnapshots.$inferSelect;
type StoredLatestAssetAnalysisInsert =
  typeof assetAnalysisLatestSnapshots.$inferInsert;

export function serializeLatestAssetAnalysis(
  analysis: LatestAssetAnalysis,
): StoredLatestAssetAnalysisInsert {
  return {
    id: analysis.id,
    assetId: analysis.asset.id,
    timeframe: analysis.marketSnapshot.timeframe,
    generatedAt: new Date(analysis.generatedAt),
    asset: analysis.asset,
    marketSnapshot: analysis.marketSnapshot,
    indicatorSnapshot: analysis.indicatorSnapshot,
    position: analysis.position ?? null,
    state: analysis.state,
    suggestion: analysis.suggestion,
    summary: analysis.summary,
    decisionCard: analysis.decisionCard,
    regime: analysis.regime,
    bias: analysis.bias,
    signalStrengthScore: analysis.signalStrengthScore,
    aiConfidence: analysis.aiConfidence,
    originalAiConfidence: analysis.originalAiConfidence ?? null,
    concerns: analysis.concerns,
    suggestedPositionSize: analysis.suggestedPositionSize,
    timeframeRelevance: analysis.timeframeRelevance,
    riskFlags: analysis.riskFlags,
    keyLevels: analysis.keyLevels,
    modelUsed: analysis.modelUsed,
    promptVersion: analysis.promptVersion,
    snapshotHash: analysis.snapshotHash,
    aiLatencyMs: analysis.aiLatencyMs,
    costEstimateUsd: serializeNumber(analysis.costEstimateUsd),
    triggeredBy: analysis.triggeredBy,
    notes: analysis.notes ?? null,
    metadata: analysis.metadata,
  };
}

export function parseLatestAssetAnalysis(
  row: StoredLatestAssetAnalysisRow,
): LatestAssetAnalysis {
  return latestAssetAnalysisSchema.parse({
    id: row.id,
    asset: row.asset,
    marketSnapshot: row.marketSnapshot,
    indicatorSnapshot: row.indicatorSnapshot,
    position: row.position ?? undefined,
    state: row.state,
    suggestion: row.suggestion,
    summary: row.summary,
    decisionCard: row.decisionCard,
    regime: row.regime,
    bias: row.bias,
    signalStrengthScore: row.signalStrengthScore,
    aiConfidence: row.aiConfidence,
    originalAiConfidence: row.originalAiConfidence ?? undefined,
    concerns: row.concerns,
    suggestedPositionSize: row.suggestedPositionSize,
    timeframeRelevance: row.timeframeRelevance,
    riskFlags: row.riskFlags,
    keyLevels: row.keyLevels,
    modelUsed: row.modelUsed,
    promptVersion: row.promptVersion,
    snapshotHash: row.snapshotHash,
    aiLatencyMs: row.aiLatencyMs,
    costEstimateUsd: parseNumber(row.costEstimateUsd),
    generatedAt: row.generatedAt.toISOString(),
    triggeredBy: row.triggeredBy,
    notes: row.notes ?? undefined,
    metadata: row.metadata,
  });
}

export async function saveLatestAssetAnalysis(
  analysis: LatestAssetAnalysis,
  connectionString?: string,
) {
  const values = serializeLatestAssetAnalysis(analysis);
  const db = getDb(connectionString);

  await db
    .insert(assetAnalysisLatestSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: assetAnalysisLatestSnapshots.id,
      set: {
        ...values,
        updatedAt: sql`now()`,
      },
    });

  return analysis;
}

export async function getLatestAssetAnalysis(
  assetId: string,
  timeframe: LatestAssetAnalysis["marketSnapshot"]["timeframe"],
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const row = await db.query.assetAnalysisLatestSnapshots.findFirst({
    where: and(
      eq(assetAnalysisLatestSnapshots.assetId, assetId),
      eq(assetAnalysisLatestSnapshots.timeframe, timeframe),
    ),
  });

  return row ? parseLatestAssetAnalysis(row) : null;
}

export async function listLatestAssetAnalyses(connectionString?: string) {
  const db = getDb(connectionString);
  const rows = await db.query.assetAnalysisLatestSnapshots.findMany();

  return rows.map(parseLatestAssetAnalysis);
}

export async function getDailyAiCostTotalUsd(
  day: Date,
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const dayStart = new Date(day);
  const nextDayStart = new Date(day);

  dayStart.setUTCHours(0, 0, 0, 0);
  nextDayStart.setUTCDate(dayStart.getUTCDate() + 1);
  nextDayStart.setUTCHours(0, 0, 0, 0);

  const result = await db
    .select({
      total: sql<string>`coalesce(sum(cast(${assetAnalysisLatestSnapshots.costEstimateUsd} as numeric)), 0)::text`,
    })
    .from(assetAnalysisLatestSnapshots)
    .where(
      and(
        gte(assetAnalysisLatestSnapshots.generatedAt, dayStart),
        lt(assetAnalysisLatestSnapshots.generatedAt, nextDayStart),
      ),
    );

  return parseNumber(result[0]?.total ?? "0");
}

function serializeNumber(value: number) {
  return value.toString();
}

function parseNumber(value: string) {
  return Number(value);
}

export type { LatestAssetAnalysis } from "@trading-analyst/shared-types";
