import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const requiredWebEnvKeys = ["NEXT_PUBLIC_API_BASE_URL"] as const;
const { config: loadDotEnv } = dotenv;

type MutableEnv = Record<string, string | undefined>;
type WebEnv = {
  NEXT_PUBLIC_API_BASE_URL: string | undefined;
};
type WorkspaceEnvOptions = {
  appDir?: string;
  env?: MutableEnv;
};

const webAppDir = path.dirname(fileURLToPath(import.meta.url));

function getEnvFiles(nodeEnv: string | undefined): string[] {
  const mode =
    nodeEnv === "production" || nodeEnv === "test" ? nodeEnv : "development";

  return [".env", `.env.${mode}`, ".env.local"];
}

export function shouldLoadWorkspaceEnv(env: MutableEnv = process.env): boolean {
  return requiredWebEnvKeys.some((key) => env[key] === undefined);
}

export function ensureWorkspaceEnvLoaded(
  options: WorkspaceEnvOptions = {},
): boolean {
  const env = options.env ?? (process.env as MutableEnv);

  if (!shouldLoadWorkspaceEnv(env)) {
    return false;
  }

  const loadedEnv: MutableEnv = {};
  const workspaceRoot = path.resolve(options.appDir ?? webAppDir, "../..");

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

export function loadWebEnv(
  overrides?: Partial<WebEnv>,
  options: WorkspaceEnvOptions = {},
): WebEnv {
  const env = {
    ...(options.env ?? (process.env as MutableEnv)),
    ...overrides,
  };

  const loadOptions: WorkspaceEnvOptions = { env };

  if (options.appDir !== undefined) {
    loadOptions.appDir = options.appDir;
  }

  ensureWorkspaceEnvLoaded(loadOptions);

  return {
    NEXT_PUBLIC_API_BASE_URL: env.NEXT_PUBLIC_API_BASE_URL,
  };
}
