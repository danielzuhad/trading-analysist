import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closeDatabase, pingDatabase, runRawQuery } from "../src/index.js";

const runInfrastructureTests = process.env.RUN_INFRA_TESTS === "true";
const describeInfrastructure = runInfrastructureTests
  ? describe
  : describe.skip;
const databaseUrl = process.env.DATABASE_URL;

if (runInfrastructureTests && !databaseUrl) {
  throw new Error("DATABASE_URL is required when RUN_INFRA_TESTS=true.");
}

describeInfrastructure("database integration", () => {
  afterAll(async () => {
    await closeDatabase(databaseUrl);
  });

  it("connects and exposes the baseline migration tables", async () => {
    await pingDatabase(databaseUrl);

    const result = await runRawQuery<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public' and table_name = $1
      `,
      ["service_heartbeats"],
      databaseUrl,
    );

    expect(result.rows).toEqual([{ table_name: "service_heartbeats" }]);
  });

  it("persists service heartbeat rows through the shared SQL helper", async () => {
    const serviceName = `db-test-${randomUUID()}`;

    await runRawQuery(
      `
        insert into service_heartbeats (service_name, status, payload)
        values ($1, $2, $3::jsonb)
      `,
      [serviceName, "ready", JSON.stringify({ source: "vitest" })],
      databaseUrl,
    );

    const result = await runRawQuery<{
      payload: { source: string };
      status: string;
    }>(
      `
        select status, payload
        from service_heartbeats
        where service_name = $1
      `,
      [serviceName],
      databaseUrl,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      status: "ready",
      payload: {
        source: "vitest",
      },
    });
  });
});
