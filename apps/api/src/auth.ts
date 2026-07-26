import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestUser, UserRole } from "@trading-analyst/shared-types";
import type { FastifyInstance, FastifyRequest } from "fastify";

const publicPaths = new Set(["/health", "/readyz"]);
const publicPrefixes = ["/chat-layer/"];

declare module "fastify" {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

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

  return (
    providedDigest.length === expectedDigest.length &&
    timingSafeEqual(providedDigest, expectedDigest)
  );
}

function readBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = header.slice("Bearer ".length).trim();

  return token.length > 0 ? token : undefined;
}

export const disabledAuthUserId = "auth-disabled:local";

type Dependencies = {
  /**
   * Legacy single shared token, kept only as a bootstrap escape hatch
   * (e.g. generating the first admin user before any api_tokens exist).
   * Requests authenticated this way are attributed to the bootstrapUserId.
   */
  bootstrapToken?: string | undefined;
  bootstrapUserId?: string | undefined;
  /**
   * When false (the default `API_AUTH_TOKEN` unset case), authentication is
   * fully disabled — every request is trusted as disabledAuthUserId. Never
   * do this in production.
   */
  enabled: boolean;
  resolveApiToken: (
    token: string,
  ) => Promise<{ userId: string; role: UserRole } | null>;
};

export function registerAuthGuard(
  app: FastifyInstance,
  dependencies: Dependencies,
): void {
  const { bootstrapToken, bootstrapUserId, enabled, resolveApiToken } =
    dependencies;

  if (!enabled) {
    app.log.warn(
      "No authentication configured. API authentication is disabled; do not run this configuration in production.",
    );
    app.addHook("onRequest", async (request: FastifyRequest) => {
      request.user = { role: "admin", userId: disabledAuthUserId };
    });
    return;
  }

  app.addHook("onRequest", async (request: FastifyRequest, reply) => {
    const pathname = request.raw.url?.split("?")[0] ?? "";

    if (isPublicApiPath(pathname)) {
      return;
    }

    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    if (
      bootstrapToken &&
      bootstrapUserId &&
      isAuthorizedBearerHeader(`Bearer ${token}`, bootstrapToken)
    ) {
      request.user = { role: "admin", userId: bootstrapUserId };
      return;
    }

    const resolved = await resolveApiToken(token);

    if (!resolved) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    request.user = { role: resolved.role, userId: resolved.userId };
  });
}
