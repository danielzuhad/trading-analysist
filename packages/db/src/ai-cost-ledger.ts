import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { aiCostLedger } from "./schema/index.js";

export async function recordAiCost(
  {
    analysisId,
    assetId,
    costEstimateUsd,
    generatedAt,
    timeframe,
    userId,
  }: {
    analysisId: string;
    assetId: string;
    costEstimateUsd: number;
    generatedAt: string;
    timeframe: string;
    userId: string;
  },
  connectionString?: string,
): Promise<void> {
  const db = getDb(connectionString);

  await db.insert(aiCostLedger).values({
    analysisId,
    assetId,
    costEstimateUsd: costEstimateUsd.toString(),
    generatedAt: new Date(generatedAt),
    timeframe,
    userId,
  });
}

export async function getDailyAiCostTotalUsdForUser(
  userId: string,
  day: Date,
  connectionString?: string,
): Promise<number> {
  const db = getDb(connectionString);
  const dayStart = new Date(day);
  const nextDayStart = new Date(day);

  dayStart.setUTCHours(0, 0, 0, 0);
  nextDayStart.setUTCDate(dayStart.getUTCDate() + 1);
  nextDayStart.setUTCHours(0, 0, 0, 0);

  const result = await db
    .select({
      total: sql<string>`coalesce(sum(cast(${aiCostLedger.costEstimateUsd} as numeric)), 0)::text`,
    })
    .from(aiCostLedger)
    .where(
      and(
        eq(aiCostLedger.userId, userId),
        gte(aiCostLedger.generatedAt, dayStart),
        lt(aiCostLedger.generatedAt, nextDayStart),
      ),
    );

  return Number(result[0]?.total ?? "0");
}
