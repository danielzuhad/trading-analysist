import { z } from "zod";

export const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
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
