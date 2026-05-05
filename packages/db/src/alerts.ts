import type {
  Alert,
  AlertStatus,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";
import { alertSchema } from "@trading-analyst/shared-types";
import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { alerts } from "./schema/index.js";

type StoredAlertRow = typeof alerts.$inferSelect;
type StoredAlertInsert = typeof alerts.$inferInsert;

export type ListAlertsFilters = {
  assetId?: string;
  limit?: number;
  status?: AlertStatus;
  timeframe?: SupportedTimeframe;
};

export type SaveAlertResult = {
  alert: Alert;
  status: "created" | "deduplicated";
};

export function serializeAlert(alert: Alert): StoredAlertInsert {
  return {
    id: alert.id,
    userId: alert.userId,
    assetId: alert.assetId,
    watchlistId: alert.watchlistId ?? null,
    positionId: alert.positionId ?? null,
    analysisId: alert.analysisId ?? null,
    transitionId: alert.transitionId ?? null,
    timeframe: alert.timeframe,
    dedupeKey: alert.dedupeKey,
    kind: alert.kind,
    severity: alert.severity,
    status: alert.status,
    channels: alert.channels,
    title: alert.title,
    message: alert.message,
    summary: alert.summary,
    previousState: alert.previousState ?? null,
    currentState: alert.currentState,
    suggestion: alert.suggestion ?? null,
    createdAt: new Date(alert.createdAt),
    deliveredAt: alert.deliveredAt ? new Date(alert.deliveredAt) : null,
    acknowledgedAt: alert.acknowledgedAt
      ? new Date(alert.acknowledgedAt)
      : null,
    expiresAt: alert.expiresAt ? new Date(alert.expiresAt) : null,
    isStale: alert.isStale,
    metadata: alert.metadata,
  };
}

export function parseAlert(row: StoredAlertRow): Alert {
  return alertSchema.parse({
    id: row.id,
    userId: row.userId,
    assetId: row.assetId,
    watchlistId: row.watchlistId ?? undefined,
    positionId: row.positionId ?? undefined,
    analysisId: row.analysisId ?? undefined,
    transitionId: row.transitionId ?? undefined,
    timeframe: row.timeframe,
    dedupeKey: row.dedupeKey,
    kind: row.kind,
    severity: row.severity,
    status: row.status,
    channels: row.channels,
    title: row.title,
    message: row.message,
    summary: row.summary,
    previousState: row.previousState ?? undefined,
    currentState: row.currentState,
    suggestion: row.suggestion ?? undefined,
    createdAt: row.createdAt.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    isStale: row.isStale,
    metadata: row.metadata,
  });
}

export async function saveAlert(
  alert: Alert,
  connectionString?: string,
): Promise<SaveAlertResult> {
  const values = serializeAlert(alert);
  const db = getDb(connectionString);
  const inserted = await db
    .insert(alerts)
    .values(values)
    .onConflictDoNothing({
      target: alerts.dedupeKey,
    })
    .returning({
      id: alerts.id,
    });

  return {
    alert,
    status: inserted.length > 0 ? "created" : "deduplicated",
  };
}

export async function listAlerts(
  filters: ListAlertsFilters = {},
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const conditions: SQL[] = [];
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);

  if (filters.assetId) {
    conditions.push(eq(alerts.assetId, filters.assetId));
  }

  if (filters.timeframe) {
    conditions.push(eq(alerts.timeframe, filters.timeframe));
  }

  if (filters.status) {
    conditions.push(eq(alerts.status, filters.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(alerts)
    .where(where)
    .orderBy(desc(alerts.createdAt))
    .limit(limit);

  return rows.map(parseAlert);
}

export async function getAlert(
  alertId: string,
  connectionString?: string,
): Promise<Alert | null> {
  const db = getDb(connectionString);
  const row = await db.query.alerts.findFirst({
    where: eq(alerts.id, alertId),
  });

  return row ? parseAlert(row) : null;
}

export async function markAlertDelivered(
  alertId: string,
  {
    deliveredAt = new Date().toISOString(),
    metadata,
    status = "delivered",
  }: {
    deliveredAt?: string;
    metadata?: Record<string, unknown>;
    status?: AlertStatus;
  } = {},
  connectionString?: string,
) {
  const current = await getAlert(alertId, connectionString);

  if (!current) {
    return null;
  }

  const updated = alertSchema.parse({
    ...current,
    deliveredAt,
    metadata: {
      ...current.metadata,
      ...(metadata ?? {}),
    },
    status,
  });
  const values = serializeAlert(updated);
  const db = getDb(connectionString);

  await db
    .update(alerts)
    .set({
      deliveredAt: values.deliveredAt,
      metadata: values.metadata,
      status: values.status,
      updatedAt: sql`now()`,
    })
    .where(eq(alerts.id, alertId));

  return updated;
}

export async function markStaleAlertsForAssetTimeframe({
  assetId,
  connectionString,
  currentAlertId,
  timeframe,
}: {
  assetId: string;
  connectionString?: string;
  currentAlertId: string;
  timeframe: SupportedTimeframe;
}) {
  const db = getDb(connectionString);

  await db
    .update(alerts)
    .set({
      isStale: true,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(alerts.assetId, assetId),
        eq(alerts.timeframe, timeframe),
        eq(alerts.isStale, false),
        sql`${alerts.id} <> ${currentAlertId}`,
      ),
    );
}

export type { Alert } from "@trading-analyst/shared-types";
