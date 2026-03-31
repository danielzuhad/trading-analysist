import { afterEach, describe, expect, it } from "vitest";
import { missingDatabaseUrlMessage, resolveDatabaseUrl } from "./index.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("database config", () => {
  it("prefers an explicit connection string", () => {
    process.env.DATABASE_URL = "db://env.invalid/env_db";

    expect(resolveDatabaseUrl("db://override.invalid/override_db")).toBe(
      "db://override.invalid/override_db",
    );
  });

  it("throws when no database URL is available", () => {
    delete process.env.DATABASE_URL;

    expect(() => resolveDatabaseUrl()).toThrowError(missingDatabaseUrlMessage);
  });
});
