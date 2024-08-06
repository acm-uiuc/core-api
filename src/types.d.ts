import { FastifyRequest, FastifyInstance, FastifyReply } from "fastify";
import { AppRoles, RunEnvironment } from "./roles.ts";
import { AadToken } from "./plugins/auth.ts";
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    authorize: (
      request: FastifyRequest,
      reply: FastifyReply,
      validRoles: AppRoles[],
    ) => Promise<void>;
    runEnvironment: RunEnvironment;
  }
  interface FastifyRequest {
    startTime: number;
    username?: string;
    tokenPayload?: AadToken;
  }
}
