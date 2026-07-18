import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";

const booleanishSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

export const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  COINGECKO_API_KEY: z.string().trim().min(1).optional(),
  COINGECKO_API_PLAN: z.enum(["demo", "basic"]).default("demo"),
  MAX_DAILY_AI_COST_USD: z.coerce.number().finite().min(0).default(2),
  TWILIO_ACCOUNT_SID: z.string().trim().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().min(1).optional(),
  TWILIO_STATUS_CALLBACK_URL: z.string().url().optional(),
  TWILIO_WHATSAPP_FROM: z.string().trim().min(1).optional(),
  TWILIO_WHATSAPP_TO: z.string().trim().min(1).optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  WORKER_ENABLE_SCHEDULER: booleanishSchema.default(true),
  WORKER_ENABLE_THRESHOLD_CHECKS: booleanishSchema.default(true),
  WORKER_SCHEDULED_ASSETS: z
    .string()
    .trim()
    .default(
      "crypto:global:BTC-USD,crypto:global:ETH-USD,crypto:global:SOL-USD",
    ),
  WORKER_SCHEDULED_TIMEFRAMES: z.string().trim().default("4H"),
  WORKER_THRESHOLD_CHECK_INTERVAL_MINUTES: z.coerce
    .number()
    .positive()
    .default(15),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
type WorkerEnvOptions = {
  appDir?: string;
  env?: NodeJS.ProcessEnv;
};

const requiredWorkerEnvKeys = ["DATABASE_URL", "REDIS_URL"] as const;
const { config: loadDotEnv } = dotenv;
const workerAppDir = path.resolve(
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
  return requiredWorkerEnvKeys.some((key) => env[key] === undefined);
}

export function ensureWorkspaceEnvLoaded(
  options: WorkerEnvOptions = {},
): boolean {
  const env = options.env ?? process.env;

  if (!shouldLoadWorkspaceEnv(env)) {
    return false;
  }

  const loadedEnv: Record<string, string | undefined> = {};
  const workspaceRoot = path.resolve(options.appDir ?? workerAppDir, "../..");

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

export function loadWorkerEnv(
  overrides?: Partial<NodeJS.ProcessEnv>,
  options: WorkerEnvOptions = {},
): WorkerEnv {
  const env = {
    ...(options.env ?? process.env),
    ...overrides,
  };

  const loadOptions: WorkerEnvOptions = { env };

  if (options.appDir !== undefined) {
    loadOptions.appDir = options.appDir;
  }

  ensureWorkspaceEnvLoaded(loadOptions);

  return workerEnvSchema.parse({
    ...env,
  });
}
