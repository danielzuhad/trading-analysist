import { eq, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { serviceHeartbeats } from "./schema/index.js";

export type ServiceHeartbeat = {
  checkedAt: string;
  payload: Record<string, unknown> | null;
  serviceName: string;
  status: string;
};

type StoredServiceHeartbeatRow = typeof serviceHeartbeats.$inferSelect;

export function parseServiceHeartbeat(
  row: StoredServiceHeartbeatRow,
): ServiceHeartbeat {
  return {
    checkedAt: row.checkedAt.toISOString(),
    payload: row.payload,
    serviceName: row.serviceName,
    status: row.status,
  };
}

export async function saveServiceHeartbeat(
  heartbeat: Omit<ServiceHeartbeat, "checkedAt"> & {
    checkedAt?: string;
  },
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const values = {
    serviceName: heartbeat.serviceName,
    status: heartbeat.status,
    payload: heartbeat.payload ?? null,
    checkedAt: new Date(heartbeat.checkedAt ?? new Date().toISOString()),
  };

  await db
    .insert(serviceHeartbeats)
    .values(values)
    .onConflictDoUpdate({
      target: serviceHeartbeats.serviceName,
      set: {
        ...values,
      },
    });

  return {
    checkedAt: values.checkedAt.toISOString(),
    payload: values.payload,
    serviceName: values.serviceName,
    status: values.status,
  } satisfies ServiceHeartbeat;
}

export async function getServiceHeartbeat(
  serviceName: string,
  connectionString?: string,
) {
  const db = getDb(connectionString);
  const row = await db.query.serviceHeartbeats.findFirst({
    where: eq(serviceHeartbeats.serviceName, serviceName),
  });

  return row ? parseServiceHeartbeat(row) : null;
}

export async function listServiceHeartbeats(connectionString?: string) {
  const db = getDb(connectionString);
  const rows = await db.query.serviceHeartbeats.findMany({
    orderBy: (table, helpers) => helpers.asc(table.serviceName),
  });

  return rows.map(parseServiceHeartbeat);
}

export async function deleteServiceHeartbeat(
  serviceName: string,
  connectionString?: string,
) {
  const db = getDb(connectionString);

  await db
    .delete(serviceHeartbeats)
    .where(eq(serviceHeartbeats.serviceName, serviceName));
}

export async function touchServiceHeartbeat(
  serviceName: string,
  status: string,
  connectionString?: string,
) {
  const db = getDb(connectionString);

  await db
    .insert(serviceHeartbeats)
    .values({
      checkedAt: new Date(),
      payload: null,
      serviceName,
      status,
    })
    .onConflictDoUpdate({
      target: serviceHeartbeats.serviceName,
      set: {
        checkedAt: sql`now()`,
        status,
      },
    });
}
