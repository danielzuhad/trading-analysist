import {
  type CreateApiTokenResponse,
  type CreateUserInput,
  createUserInputSchema,
  type LoginInput,
  loginInputSchema,
  type User,
} from "@trading-analyst/shared-types";
import type { FastifyInstance } from "fastify";

type Dependencies = {
  createApiToken: (userId: string) => Promise<{
    token: string;
    tokenId: string;
  }>;
  createUser: (input: CreateUserInput) => Promise<User>;
  listUsers: () => Promise<User[]>;
  revokeApiToken: (
    tokenId: string,
  ) => Promise<{ status: "revoked" | "not_found" }>;
  verifyUserPassword: (email: string, password: string) => Promise<User | null>;
};

export async function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const bodyResult = loginInputSchema.safeParse(request.body);

      if (!bodyResult.success) {
        return reply.code(400).send({
          error: "INVALID_BODY",
          issues: bodyResult.error.issues,
        });
      }

      const { email, password }: LoginInput = bodyResult.data;
      const user = await dependencies.verifyUserPassword(email, password);

      if (!user) {
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }

      const { token } = await dependencies.createApiToken(user.id);

      return reply.code(201).send({ token, user });
    },
  );

  app.post("/auth/users", async (request, reply) => {
    if (request.user?.role !== "admin") {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const bodyResult = createUserInputSchema.safeParse(request.body);

    if (!bodyResult.success) {
      return reply.code(400).send({
        error: "INVALID_BODY",
        issues: bodyResult.error.issues,
      });
    }

    const user = await dependencies.createUser(bodyResult.data);
    const { token, tokenId }: CreateApiTokenResponse = {
      ...(await dependencies.createApiToken(user.id)),
      userId: user.id,
    };

    return reply.code(201).send({ token, tokenId, user });
  });

  app.get("/auth/users", async (request, reply) => {
    if (request.user?.role !== "admin") {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const users = await dependencies.listUsers();

    return { count: users.length, users };
  });

  app.post("/auth/logout", async (request, reply) => {
    const tokenId = request.user?.tokenId;

    if (!tokenId) {
      return reply.code(204).send();
    }

    await dependencies.revokeApiToken(tokenId);

    return reply.code(204).send();
  });
}
