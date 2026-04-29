import { randomUUID } from "node:crypto";
import type {
  ClosePositionInput,
  CreatePositionInput,
  Position,
  PositionStatus,
  UpdatePositionInput,
} from "@trading-analyst/shared-types";
import { positionSchema } from "@trading-analyst/shared-types";
import { and, desc, eq, or, type SQL, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { positions } from "./schema/index.js";

type StoredPositionRow = typeof positions.$inferSelect;
type StoredPositionInsert = typeof positions.$inferInsert;

export type ListPositionsFilters = {
  activeOnly?: boolean;
  assetId?: string;
  limit?: number;
  status?: PositionStatus;
  userId?: string;
};

export const activePositionStatuses = ["open", "partially_closed"] as const;

export function buildPositionFromInput(
  input: CreatePositionInput,
  now = new Date().toISOString(),
): Position {
  return positionSchema.parse({
    id: `position:${randomUUID()}`,
    userId: input.userId,
    assetId: input.assetId,
    ...(input.watchlistId ? { watchlistId: input.watchlistId } : {}),
    ...(input.sourceAccount ? { sourceAccount: input.sourceAccount } : {}),
    direction: input.direction,
    status: input.status,
    ...(input.quoteCurrency ? { quoteCurrency: input.quoteCurrency } : {}),
    entryPrice: input.entryPrice,
    averageEntryPrice: input.averageEntryPrice ?? input.entryPrice,
    quantity: input.quantity,
    remainingQuantity: input.remainingQuantity ?? input.quantity,
    ...(input.notionalValue !== undefined
      ? { notionalValue: input.notionalValue }
      : {}),
    ...(input.realizedPnl !== undefined
      ? { realizedPnl: input.realizedPnl }
      : {}),
    ...(input.unrealizedPnl !== undefined
      ? { unrealizedPnl: input.unrealizedPnl }
      : {}),
    ...(input.realizedPnlPercent !== undefined
      ? { realizedPnlPercent: input.realizedPnlPercent }
      : {}),
    ...(input.unrealizedPnlPercent !== undefined
      ? { unrealizedPnlPercent: input.unrealizedPnlPercent }
      : {}),
    ...(input.stopLoss !== undefined ? { stopLoss: input.stopLoss } : {}),
    takeProfitLevels: input.takeProfitLevels,
    ...(input.thesis ? { thesis: input.thesis } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.latestState ? { latestState: input.latestState } : {}),
    ...(input.latestSuggestion
      ? { latestSuggestion: input.latestSuggestion }
      : {}),
    openedAt: input.openedAt ?? now,
    lastUpdatedAt: now,
    isBackfilled: false,
    metadata: input.metadata,
  });
}

export function serializePosition(position: Position): StoredPositionInsert {
  return {
    id: position.id,
    userId: position.userId,
    assetId: position.assetId,
    watchlistId: position.watchlistId ?? null,
    sourceAccount: position.sourceAccount ?? null,
    direction: position.direction,
    status: position.status,
    quoteCurrency: position.quoteCurrency ?? null,
    entryPrice: serializeNumber(position.entryPrice),
    averageEntryPrice: serializeNumber(position.averageEntryPrice),
    quantity: serializeNumber(position.quantity),
    remainingQuantity: serializeNumber(position.remainingQuantity),
    notionalValue: serializeOptionalNumber(position.notionalValue),
    realizedPnl: serializeOptionalNumber(position.realizedPnl),
    unrealizedPnl: serializeOptionalNumber(position.unrealizedPnl),
    realizedPnlPercent: serializeOptionalNumber(position.realizedPnlPercent),
    unrealizedPnlPercent: serializeOptionalNumber(
      position.unrealizedPnlPercent,
    ),
    stopLoss: serializeOptionalNumber(position.stopLoss),
    takeProfitLevels: position.takeProfitLevels,
    thesis: position.thesis ?? null,
    notes: position.notes ?? null,
    latestState: position.latestState ?? null,
    latestSuggestion: position.latestSuggestion ?? null,
    openedAt: new Date(position.openedAt),
    closedAt: position.closedAt ? new Date(position.closedAt) : null,
    lastUpdatedAt: new Date(position.lastUpdatedAt),
    isBackfilled: position.isBackfilled,
    metadata: position.metadata,
  };
}

export function parsePosition(row: StoredPositionRow): Position {
  return positionSchema.parse({
    id: row.id,
    userId: row.userId,
    assetId: row.assetId,
    watchlistId: row.watchlistId ?? undefined,
    sourceAccount: row.sourceAccount ?? undefined,
    direction: row.direction,
    status: row.status,
    quoteCurrency: row.quoteCurrency ?? undefined,
    entryPrice: parseNumber(row.entryPrice),
    averageEntryPrice: parseNumber(row.averageEntryPrice),
    quantity: parseNumber(row.quantity),
    remainingQuantity: parseNumber(row.remainingQuantity),
    notionalValue: parseOptionalNumber(row.notionalValue),
    realizedPnl: parseOptionalNumber(row.realizedPnl),
    unrealizedPnl: parseOptionalNumber(row.unrealizedPnl),
    realizedPnlPercent: parseOptionalNumber(row.realizedPnlPercent),
    unrealizedPnlPercent: parseOptionalNumber(row.unrealizedPnlPercent),
    stopLoss: parseOptionalNumber(row.stopLoss),
    takeProfitLevels: row.takeProfitLevels,
    thesis: row.thesis ?? undefined,
    notes: row.notes ?? undefined,
    latestState: row.latestState ?? undefined,
    latestSuggestion: row.latestSuggestion ?? undefined,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString(),
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
    isBackfilled: row.isBackfilled,
    metadata: row.metadata,
  });
}

export async function createPosition(
  input: CreatePositionInput,
  connectionString?: string,
) {
  const position = buildPositionFromInput(input);
  return savePosition(position, connectionString);
}

export async function savePosition(
  position: Position,
  connectionString?: string,
) {
  const values = serializePosition(position);
  const db = getDb(connectionString);

  await db
    .insert(positions)
    .values(values)
    .onConflictDoUpdate({
      target: positions.id,
      set: {
        ...values,
        updatedAt: sql`now()`,
      },
    });

  return position;
}

export async function getPosition(
  positionId: string,
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const row = await db.query.positions.findFirst({
    where: eq(positions.id, positionId),
  });

  return row ? parsePosition(row) : null;
}

export async function listPositions(
  filters: ListPositionsFilters = {},
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const conditions = buildPositionFilterConditions(filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const rows = await db
    .select()
    .from(positions)
    .where(where)
    .orderBy(desc(positions.openedAt), desc(positions.lastUpdatedAt))
    .limit(limit);

  return rows.map(parsePosition);
}

export async function getActivePositionForAsset({
  assetId,
  connectionString,
  userId,
}: {
  assetId: string;
  connectionString?: string;
  userId?: string;
}) {
  const rows = await listPositions(
    {
      activeOnly: true,
      assetId,
      limit: 1,
      ...(userId ? { userId } : {}),
    },
    connectionString,
  );

  return rows[0] ?? null;
}

export async function updatePosition(
  positionId: string,
  input: UpdatePositionInput,
  connectionString?: string,
) {
  const current = await getPosition(positionId, connectionString);

  if (!current) {
    return null;
  }

  const updated = positionSchema.parse({
    ...current,
    ...input,
    lastUpdatedAt: new Date().toISOString(),
  });

  return savePosition(updated, connectionString);
}

export async function closePosition(
  positionId: string,
  input: ClosePositionInput,
  connectionString?: string,
) {
  const current = await getPosition(positionId, connectionString);

  if (!current) {
    return null;
  }

  const closedAt = input.closedAt ?? new Date().toISOString();
  const updated = positionSchema.parse({
    ...current,
    ...(input.realizedPnl !== undefined
      ? { realizedPnl: input.realizedPnl }
      : {}),
    ...(input.realizedPnlPercent !== undefined
      ? { realizedPnlPercent: input.realizedPnlPercent }
      : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    closedAt,
    lastUpdatedAt: closedAt,
    remainingQuantity: input.remainingQuantity,
    status: "closed",
  });

  return savePosition(updated, connectionString);
}

function buildPositionFilterConditions(filters: ListPositionsFilters) {
  const conditions: SQL[] = [];

  if (filters.assetId) {
    conditions.push(eq(positions.assetId, filters.assetId));
  }

  if (filters.userId) {
    conditions.push(eq(positions.userId, filters.userId));
  }

  if (filters.status) {
    conditions.push(eq(positions.status, filters.status));
  } else if (filters.activeOnly) {
    conditions.push(
      or(
        eq(positions.status, "open"),
        eq(positions.status, "partially_closed"),
      ) as SQL,
    );
  }

  return conditions;
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

export type { Position } from "@trading-analyst/shared-types";
