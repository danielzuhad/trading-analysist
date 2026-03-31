import { z } from "zod";

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(overrides?: Partial<NodeJS.ProcessEnv>): ApiEnv {
  return apiEnvSchema.parse({
    ...process.env,
    ...overrides,
  });
}
