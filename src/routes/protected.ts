import { FastifyPluginAsync } from "fastify";
import { AppRoles } from "../roles.js";

const protectedRoute: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get(
    "/",
    {
      onRequest: fastify.auth([
        fastify.authenticate,
        async (request, reply) => {
          fastify.authorize(request, reply, [AppRoles.MANAGER]);
        },
      ]),
    },
    async (request, reply) => {
      reply.send({
        message: "hi",
      });
    },
  );
};

export default protectedRoute;
