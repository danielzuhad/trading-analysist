import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type QueryResultRow } from "pg";
import { schema } from "./schema/index.js";

const defaultDatabaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/trading_analyst";

let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: defaultDatabaseUrl,
    });
  }

  return pool;
}

export function getDb() {
  return drizzle(getPool(), {
    schema,
  });
}

export async function pingDatabase() {
  const db = getDb();
  await db.execute(sql`select 1`);
}

export async function closeDatabase() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}

export async function runRawQuery<T extends QueryResultRow = QueryResultRow>(
  queryText: string,
  values: unknown[] = [],
) {
  return getPool().query<T>(queryText, values);
}

export { schema };
