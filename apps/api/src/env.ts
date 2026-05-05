import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  TWILIO_AUTH_TOKEN: z.string().trim().min(1).optional(),
  TWILIO_WEBHOOK_URL: z.string().url().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
type ApiEnvOptions = {
  appDir?: string;
  env?: NodeJS.ProcessEnv;
};

const requiredApiEnvKeys = ["DATABASE_URL", "REDIS_URL"] as const;
const { config: loadDotEnv } = dotenv;
const apiAppDir = path.resolve(
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
  return requiredApiEnvKeys.some((key) => env[key] === undefined);
}

export function ensureWorkspaceEnvLoaded(options: ApiEnvOptions = {}): boolean {
  const env = options.env ?? process.env;

  if (!shouldLoadWorkspaceEnv(env)) {
    return false;
  }

  const loadedEnv: Record<string, string | undefined> = {};
  const workspaceRoot = path.resolve(options.appDir ?? apiAppDir, "../..");

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

export function loadApiEnv(
  overrides?: Partial<NodeJS.ProcessEnv>,
  options: ApiEnvOptions = {},
): ApiEnv {
  const env = {
    ...(options.env ?? process.env),
    ...overrides,
  };

  const loadOptions: ApiEnvOptions = { env };

  if (options.appDir !== undefined) {
    loadOptions.appDir = options.appDir;
  }

  ensureWorkspaceEnvLoaded(loadOptions);

  return apiEnvSchema.parse({
    ...env,
  });
}
