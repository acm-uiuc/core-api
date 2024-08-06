import { FastifyPluginAsync } from "fastify";
import { AppRoles } from "../roles.js";

const protectedRoute: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get(
    "/",
    {
      onRequest:
        async (request, reply) => {
          await fastify.authorize(request, reply, [AppRoles.MANAGER]);
        }
    },
    async (request, reply) => {
      reply.send({
        username: request.username,
      });
    },
  );
};

export default protectedRoute;
