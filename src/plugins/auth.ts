import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { BaseError, UnauthenticatedError, UnauthorizedError } from "../errors/index.js";
import { AppRoles } from "../roles.js";

// const GroupRoleMapping: Record<string, AppRoles[]> = {};

const authPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.decorate(
    "authenticate",
    async function (
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> {
      try {
        const clientId = process.env.AadValidClientId;
        if (!clientId) {
          throw new UnauthenticatedError({message: "Server could not find valid AAD Client ID."})
        }
      } catch (err: unknown) {
        if (err instanceof BaseError) {
          throw err;
        }
        throw new UnauthenticatedError({ message: "Could not verify JWT." });
      }
    },
  );
  fastify.decorate(
    "authorize",
    async function (
      request: FastifyRequest,
      _reply: FastifyReply,
      _validRoles: AppRoles[],
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
