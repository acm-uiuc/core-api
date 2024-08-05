import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { UnauthenticatedError, UnauthorizedError } from "../errors/index.js";
import { EventsApiRoles } from "../roles.js";

// const GroupRoleMapping: Record<string, EventsApiRoles[]> = {};

const authPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.decorate(
    "authenticate",
    async function (
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> {
      try {
        request.log.info("Authenticating JWT");
      } catch (_: unknown) {
        throw new UnauthenticatedError({ message: "Could not verify JWT." });
      }
    },
  );
  fastify.decorate(
    "authorize",
    async function (
      request: FastifyRequest,
      _reply: FastifyReply,
      _validRoles: EventsApiRoles[],
    ): Promise<void> {
      try {
        request.log.info("Authorizing JWT");
      } catch (_: unknown) {
        throw new UnauthorizedError({
          message: "Could not get expected role.",
        });
      }
    },
  );
};

const fastifyAuthPlugin = fp(authPlugin);
export default fastifyAuthPlugin;
