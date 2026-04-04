import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type QueryResultRow } from "pg";
import { schema } from "./schema/index.js";

const pools = new Map<string, Pool>();
const missingDatabaseUrlMessage =
  "DATABASE_URL is required. Define it in your environment or pass a connection string explicitly.";

export function resolveDatabaseUrl(connectionString?: string) {
  const databaseUrl = connectionString ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(missingDatabaseUrlMessage);
  }

  return databaseUrl;
}

export function getPool(connectionString?: string) {
  const databaseUrl = resolveDatabaseUrl(connectionString);
  const existingPool = pools.get(databaseUrl);

  if (existingPool) {
    return existingPool;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  pools.set(databaseUrl, pool);

  return pool;
}

export function getDb(connectionString?: string) {
  return drizzle(getPool(connectionString), {
    schema,
  });
}

export async function pingDatabase(connectionString?: string) {
  const db = getDb(connectionString);
  await db.execute(sql`select 1`);
}

export async function closeDatabase(connectionString?: string) {
  if (connectionString) {
    const databaseUrl = resolveDatabaseUrl(connectionString);
    const pool = pools.get(databaseUrl);

    if (!pool) {
      return;
    }

    await pool.end();
    pools.delete(databaseUrl);
    return;
  }

  await Promise.all([...pools.values()].map((pool) => pool.end()));
  pools.clear();
}

export async function runRawQuery<T extends QueryResultRow = QueryResultRow>(
  queryText: string,
  values: unknown[] = [],
  connectionString?: string,
) {
  return getPool(connectionString).query<T>(queryText, values);
}

export { missingDatabaseUrlMessage, schema };
