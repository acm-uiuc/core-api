import { FastifyPluginAsync } from "fastify";

const protectedRoute: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get("/", async (request, reply) => {
    const roles = await fastify.authorize(request, reply, []);
    reply.send({ username: request.username, roles: Array.from(roles) });
  });
};

export default protectedRoute;
