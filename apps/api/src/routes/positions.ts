import {
  type ClosePositionInput,
  type CreatePositionInput,
  closePositionInputSchema,
  createPositionInputSchema,
  type Position,
  type PositionStatus,
  positionStatusSchema,
  type UpdatePositionInput,
  updatePositionInputSchema,
} from "@trading-analyst/shared-types";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

const createPositionBodySchema = createPositionInputSchema.omit({
  userId: true,
});

const positionsQuerySchema = z.object({
  activeOnly: z.coerce.boolean().optional(),
  assetId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: positionStatusSchema.optional(),
});

const activePositionQuerySchema = z.object({
  assetId: z.string().trim().min(1),
});

const positionParamsSchema = z.object({
  positionId: z.string().trim().min(1),
});

type Dependencies = {
  closePosition: (
    positionId: string,
    input: ClosePositionInput,
    userId: string,
  ) => Promise<Position | null>;
  createPosition: (input: CreatePositionInput) => Promise<Position>;
  getActivePositionForAsset: (filters: {
    assetId: string;
    userId: string;
  }) => Promise<Position | null>;
  listPositions: (filters: {
    activeOnly?: boolean;
    assetId?: string;
    limit?: number;
    status?: PositionStatus;
    userId: string;
  }) => Promise<Position[]>;
  updatePosition: (
    positionId: string,
    input: UpdatePositionInput,
    userId: string,
  ) => Promise<Position | null>;
};

function requireUserId(request: FastifyRequest): string {
  const userId = request.user?.userId;

  if (!userId) {
    throw new Error("Route registered without an authenticated request.");
  }

  return userId;
}

export async function registerPositionRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.get("/positions", async (request, reply) => {
    const userId = requireUserId(request);
    const queryResult = positionsQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const { activeOnly, assetId, limit, status } = queryResult.data;
    const positions = await dependencies.listPositions({
      limit,
      userId,
      ...(activeOnly !== undefined ? { activeOnly } : {}),
      ...(assetId ? { assetId } : {}),
      ...(status ? { status } : {}),
    });

    return {
      count: positions.length,
      positions,
    };
  });

  app.get("/positions/active", async (request, reply) => {
    const userId = requireUserId(request);
    const queryResult = activePositionQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY",
        issues: queryResult.error.issues,
      });
    }

    const position = await dependencies.getActivePositionForAsset({
      assetId: queryResult.data.assetId,
      userId,
    });

    if (!position) {
      return reply.code(404).send({
        assetId: queryResult.data.assetId,
        error: "ACTIVE_POSITION_NOT_FOUND",
      });
    }

    return {
      position,
    };
  });

  app.post("/positions", async (request, reply) => {
    const userId = requireUserId(request);
    const bodyResult = createPositionBodySchema.safeParse(request.body);

    if (!bodyResult.success) {
      return reply.code(400).send({
        error: "INVALID_BODY",
        issues: bodyResult.error.issues,
      });
    }

    const position = await dependencies.createPosition({
      ...bodyResult.data,
      userId,
    });

    return reply.code(201).send({
      position,
    });
  });

  app.patch("/positions/:positionId", async (request, reply) => {
    const userId = requireUserId(request);
    const paramsResult = positionParamsSchema.safeParse(request.params);
    const bodyResult = updatePositionInputSchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        issues: [
          ...(paramsResult.success ? [] : paramsResult.error.issues),
          ...(bodyResult.success ? [] : bodyResult.error.issues),
        ],
      });
    }

    const position = await dependencies.updatePosition(
      paramsResult.data.positionId,
      bodyResult.data,
      userId,
    );

    if (!position) {
      return reply.code(404).send({
        error: "POSITION_NOT_FOUND",
        positionId: paramsResult.data.positionId,
      });
    }

    return {
      position,
    };
  });

  app.post("/positions/:positionId/close", async (request, reply) => {
    const userId = requireUserId(request);
    const paramsResult = positionParamsSchema.safeParse(request.params);
    const bodyResult = closePositionInputSchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        issues: [
          ...(paramsResult.success ? [] : paramsResult.error.issues),
          ...(bodyResult.success ? [] : bodyResult.error.issues),
        ],
      });
    }

    const position = await dependencies.closePosition(
      paramsResult.data.positionId,
      bodyResult.data,
      userId,
    );

    if (!position) {
      return reply.code(404).send({
        error: "POSITION_NOT_FOUND",
        positionId: paramsResult.data.positionId,
      });
    }

    return {
      position,
    };
  });
}
