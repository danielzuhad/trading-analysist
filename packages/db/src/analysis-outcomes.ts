import type {
  AnalysisOutcome,
  AnalysisOutcomeEvaluation,
  AnalysisQualityBucket,
  AnalysisQualityResponse,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";
import {
  analysisOutcomeSchema,
  analysisQualityBucketSchema,
} from "@trading-analyst/shared-types";
import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { analysisOutcomes } from "./schema/index.js";

type StoredAnalysisOutcomeRow = typeof analysisOutcomes.$inferSelect;
type StoredAnalysisOutcomeInsert = typeof analysisOutcomes.$inferInsert;

export function serializeAnalysisOutcome(
  outcome: AnalysisOutcome,
): StoredAnalysisOutcomeInsert {
  return {
    id: outcome.id,
    analysisId: outcome.analysisId,
    assetId: outcome.assetId,
    timeframe: outcome.timeframe,
    snapshotHash: outcome.snapshotHash,
    modelUsed: outcome.modelUsed,
    promptVersion: outcome.promptVersion,
    state: outcome.state,
    suggestion: outcome.suggestion,
    bias: outcome.bias,
    signalStrengthScore: outcome.signalStrengthScore,
    aiConfidence: outcome.aiConfidence,
    keyLevels: outcome.keyLevels,
    priceAtAnalysis: serializeNumber(outcome.priceAtAnalysis),
    analysisGeneratedAt: new Date(outcome.analysisGeneratedAt),
    evaluateAfter: new Date(outcome.evaluateAfter),
    status: outcome.status,
    evaluatedAt: outcome.evaluation
      ? new Date(outcome.evaluation.evaluatedAt)
      : null,
    priceAtEvaluation: outcome.evaluation
      ? serializeNumber(outcome.evaluation.priceAtEvaluation)
      : null,
    priceChangePercent: outcome.evaluation
      ? serializeNumber(outcome.evaluation.priceChangePercent)
      : null,
    directionCorrect: outcome.evaluation?.directionCorrect ?? null,
    invalidationHit: outcome.evaluation?.invalidationHit ?? null,
    candlesCovered: outcome.evaluation?.candlesCovered ?? null,
    metadata: outcome.metadata,
  };
}

export function parseAnalysisOutcome(
  row: StoredAnalysisOutcomeRow,
): AnalysisOutcome {
  return analysisOutcomeSchema.parse({
    id: row.id,
    analysisId: row.analysisId,
    assetId: row.assetId,
    timeframe: row.timeframe,
    snapshotHash: row.snapshotHash,
    modelUsed: row.modelUsed,
    promptVersion: row.promptVersion,
    state: row.state,
    suggestion: row.suggestion,
    bias: row.bias,
    signalStrengthScore: row.signalStrengthScore,
    aiConfidence: row.aiConfidence,
    keyLevels: row.keyLevels,
    priceAtAnalysis: parseNumber(row.priceAtAnalysis),
    analysisGeneratedAt: row.analysisGeneratedAt.toISOString(),
    evaluateAfter: row.evaluateAfter.toISOString(),
    status: row.status,
    evaluation:
      row.evaluatedAt &&
      row.priceAtEvaluation !== null &&
      row.priceChangePercent !== null &&
      row.candlesCovered !== null
        ? {
            evaluatedAt: row.evaluatedAt.toISOString(),
            priceAtEvaluation: parseNumber(row.priceAtEvaluation),
            priceChangePercent: parseNumber(row.priceChangePercent),
            directionCorrect: row.directionCorrect,
            invalidationHit: row.invalidationHit,
            candlesCovered: row.candlesCovered,
          }
        : undefined,
    metadata: row.metadata,
  });
}

export async function savePendingAnalysisOutcome(
  outcome: AnalysisOutcome,
  connectionString?: string,
): Promise<{ status: "created" | "duplicate" }> {
  const db = getDb(connectionString);
  const inserted = await db
    .insert(analysisOutcomes)
    .values(serializeAnalysisOutcome(outcome))
    .onConflictDoNothing({ target: analysisOutcomes.id })
    .returning({ id: analysisOutcomes.id });

  return { status: inserted.length > 0 ? "created" : "duplicate" };
}

export async function listDueAnalysisOutcomes(
  {
    assetId,
    due,
    limit = 50,
    timeframe,
  }: {
    assetId?: string;
    due: Date;
    limit?: number;
    timeframe?: SupportedTimeframe;
  },
  connectionString?: string,
): Promise<AnalysisOutcome[]> {
  const db = getDb(connectionString);
  const rows = await db.query.analysisOutcomes.findMany({
    where: and(
      eq(analysisOutcomes.status, "pending"),
      lte(analysisOutcomes.evaluateAfter, due),
      ...(assetId ? [eq(analysisOutcomes.assetId, assetId)] : []),
      ...(timeframe ? [eq(analysisOutcomes.timeframe, timeframe)] : []),
    ),
    limit,
    orderBy: (table, { asc }) => [asc(table.evaluateAfter)],
  });

  return rows.map(parseAnalysisOutcome);
}

export async function completeAnalysisOutcome(
  outcomeId: string,
  evaluation: AnalysisOutcomeEvaluation,
  connectionString?: string,
): Promise<void> {
  const db = getDb(connectionString);

  await db
    .update(analysisOutcomes)
    .set({
      candlesCovered: evaluation.candlesCovered,
      directionCorrect: evaluation.directionCorrect,
      evaluatedAt: new Date(evaluation.evaluatedAt),
      invalidationHit: evaluation.invalidationHit,
      priceAtEvaluation: serializeNumber(evaluation.priceAtEvaluation),
      priceChangePercent: serializeNumber(evaluation.priceChangePercent),
      status: "evaluated",
      updatedAt: sql`now()`,
    })
    .where(eq(analysisOutcomes.id, outcomeId));
}

export async function getAnalysisQualitySummary(
  {
    modelUsed,
    timeframe,
  }: {
    modelUsed?: string;
    timeframe?: SupportedTimeframe;
  } = {},
  connectionString?: string,
): Promise<AnalysisQualityResponse> {
  const db = getDb(connectionString);
  const filters = [
    eq(analysisOutcomes.status, "evaluated"),
    ...(modelUsed ? [eq(analysisOutcomes.modelUsed, modelUsed)] : []),
    ...(timeframe ? [eq(analysisOutcomes.timeframe, timeframe)] : []),
  ];

  const rows = await db
    .select({
      modelUsed: analysisOutcomes.modelUsed,
      promptVersion: analysisOutcomes.promptVersion,
      timeframe: analysisOutcomes.timeframe,
      state: analysisOutcomes.state,
      evaluatedCount: sql<string>`count(*)::text`,
      directionKnownCount: sql<string>`count(${analysisOutcomes.directionCorrect})::text`,
      directionCorrectCount: sql<string>`coalesce(sum((${analysisOutcomes.directionCorrect})::int), 0)::text`,
      invalidationKnownCount: sql<string>`count(${analysisOutcomes.invalidationHit})::text`,
      invalidationHitCount: sql<string>`coalesce(sum((${analysisOutcomes.invalidationHit})::int), 0)::text`,
      avgPriceChangePercent: sql<
        string | null
      >`avg(cast(${analysisOutcomes.priceChangePercent} as numeric))::text`,
    })
    .from(analysisOutcomes)
    .where(and(...filters))
    .groupBy(
      analysisOutcomes.modelUsed,
      analysisOutcomes.promptVersion,
      analysisOutcomes.timeframe,
      analysisOutcomes.state,
    );

  const pendingFilters = [
    eq(analysisOutcomes.status, "pending"),
    ...(modelUsed ? [eq(analysisOutcomes.modelUsed, modelUsed)] : []),
    ...(timeframe ? [eq(analysisOutcomes.timeframe, timeframe)] : []),
  ];
  const pendingResult = await db
    .select({ pendingCount: sql<string>`count(*)::text` })
    .from(analysisOutcomes)
    .where(and(...pendingFilters));

  const buckets: AnalysisQualityBucket[] = rows.map((row) =>
    analysisQualityBucketSchema.parse({
      modelUsed: row.modelUsed,
      promptVersion: row.promptVersion,
      timeframe: row.timeframe,
      state: row.state,
      evaluatedCount: parseInteger(row.evaluatedCount),
      directionKnownCount: parseInteger(row.directionKnownCount),
      directionCorrectCount: parseInteger(row.directionCorrectCount),
      invalidationKnownCount: parseInteger(row.invalidationKnownCount),
      invalidationHitCount: parseInteger(row.invalidationHitCount),
      avgPriceChangePercent:
        row.avgPriceChangePercent === null
          ? null
          : parseNumber(row.avgPriceChangePercent),
    }),
  );

  return {
    buckets,
    evaluatedCount: buckets.reduce(
      (total, bucket) => total + bucket.evaluatedCount,
      0,
    ),
    pendingCount: parseInteger(pendingResult[0]?.pendingCount ?? "0"),
  };
}

function serializeNumber(value: number) {
  return value.toString();
}

function parseNumber(value: string) {
  return Number(value);
}

function parseInteger(value: string) {
  return Number.parseInt(value, 10);
}

export type {
  AnalysisOutcome,
  AnalysisOutcomeEvaluation,
  AnalysisQualityResponse,
} from "@trading-analyst/shared-types";
