import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

type DbEnvOptions = {
  env?: NodeJS.ProcessEnv;
  packageDir?: string;
};

const requiredDbEnvKeys = ["DATABASE_URL"] as const;
const { config: loadDotEnv } = dotenv;
const dbPackageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function getEnvFiles(nodeEnv: string | undefined): string[] {
  const mode =
    nodeEnv === "production" || nodeEnv === "test" ? nodeEnv : "development";

  return [".env", `.env.${mode}`, ".env.local"];
}

export function shouldLoadWorkspaceEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return requiredDbEnvKeys.some((key) => env[key] === undefined);
}

export function ensureWorkspaceEnvLoaded(options: DbEnvOptions = {}): boolean {
  const env = options.env ?? process.env;

  if (!shouldLoadWorkspaceEnv(env)) {
    return false;
  }

  const loadedEnv: Record<string, string | undefined> = {};
  const workspaceRoot = path.resolve(
    options.packageDir ?? dbPackageDir,
    "../..",
  );

  for (const envFile of getEnvFiles(env.NODE_ENV)) {
    loadDotEnv({
      path: path.join(workspaceRoot, envFile),
      processEnv: loadedEnv,
      override: true,
      quiet: true,
    });
  }

  let didLoad = false;

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (env[key] === undefined) {
      env[key] = value;
      didLoad = true;
    }
  }

  return didLoad;
}
