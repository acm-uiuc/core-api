import { FastifyPluginAsync } from "fastify";
import { EventsApiRoles } from "../roles.js";

const protectedRoute: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get(
    "/",
    {
      onRequest: fastify.auth([
        fastify.authenticate,
        async (request, reply) => {
          fastify.authorize(request, reply, [EventsApiRoles.MANAGER]);
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
