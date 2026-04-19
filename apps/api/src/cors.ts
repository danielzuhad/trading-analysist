import type { FastifyInstance } from "fastify";

export async function registerCors(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const originHeader = request.headers.origin;

    reply.header("Access-Control-Allow-Methods", "GET,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");

    if (originHeader) {
      reply.header("Access-Control-Allow-Origin", originHeader);
      reply.header("Vary", "Origin");
    } else {
      reply.header("Access-Control-Allow-Origin", "*");
    }

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}
