import { buildApp } from "./app.js";
import { loadApiEnv } from "./env.js";

const env = loadApiEnv();
const app = await buildApp(env);

try {
  await app.listen({
    host: env.API_HOST,
    port: env.API_PORT,
  });
} catch (error) {
  app.log.error(error, "failed to start api");
  process.exit(1);
}
