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
    process.env.DATABASE_URL = "postgresql://env.example.com:5432/env_db";

    expect(
      resolveDatabaseUrl("postgresql://override.example.com:5432/override_db"),
    ).toBe("postgresql://override.example.com:5432/override_db");
  });

  it("throws when no database URL is available", () => {
    delete process.env.DATABASE_URL;

    expect(() => resolveDatabaseUrl()).toThrowError(missingDatabaseUrlMessage);
  });
});
