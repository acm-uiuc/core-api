import { FastifyPluginAsync } from "fastify";
import { GroupNameMapping, KnownAzureGroupId } from "../config.js";

const protectedRoute: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get("/", async (request, reply) => {
    const roles = await fastify.authorize(request, reply, []);
    const groups = [];
    for (const group in request.tokenPayload?.groups) {
      groups.push({
        id: group,
        name: GroupNameMapping[group as KnownAzureGroupId],
      });
    }

    reply.send({
      username: request.username,
      roles: Array.from(roles),
      groups,
    });
  });
};

export default protectedRoute;
