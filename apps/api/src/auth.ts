import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

const publicPaths = new Set(["/health", "/readyz"]);
const publicPrefixes = ["/chat-layer/"];

export function isPublicApiPath(pathname: string): boolean {
  if (publicPaths.has(pathname)) {
    return true;
  }

  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function isAuthorizedBearerHeader(
  header: string | undefined,
  expectedToken: string,
): boolean {
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const provided = header.slice("Bearer ".length).trim();

  if (provided.length === 0) {
    return false;
  }

  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expectedToken).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}

export function registerAuthGuard(
  app: FastifyInstance,
  options: { token?: string | undefined },
): void {
  const token = options.token?.trim();

  if (!token) {
    app.log.warn(
      "API_AUTH_TOKEN is not set. API authentication is disabled; do not run this configuration in production.",
    );
    return;
  }

  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.raw.url?.split("?")[0] ?? "";

    if (isPublicApiPath(pathname)) {
      return;
    }

    if (!isAuthorizedBearerHeader(request.headers.authorization, token)) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });
}
