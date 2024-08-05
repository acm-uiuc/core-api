import { FastifyRequest, FastifyInstance, FastifyReply } from "fastify";
import { AppRoles } from "./roles.ts";
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
    runEnvironment: string;
  }
  interface FastifyRequest {
    startTime: number;
  }
}
