import { z } from "zod";

export const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  TWELVE_DATA_API_KEY: z.string().trim().min(1).optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnv(
  overrides?: Partial<NodeJS.ProcessEnv>,
): WorkerEnv {
  return workerEnvSchema.parse({
    ...process.env,
    ...overrides,
  });
}
