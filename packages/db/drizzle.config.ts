import { defineConfig } from "drizzle-kit";
import { ensureWorkspaceEnvLoaded } from "./src/env.js";

ensureWorkspaceEnvLoaded();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required to run Drizzle commands. Define it in your environment.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
