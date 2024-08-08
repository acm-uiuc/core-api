import { FastifyPluginAsync } from "fastify";
import { OrganizationList } from "../orgs.js";

const organizationsPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get("/", {}, async (request, reply) => {
    reply.send(OrganizationList);
  });
};

export default organizationsPlugin;
