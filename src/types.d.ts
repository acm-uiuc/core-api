import { FastifyRequest, FastifyInstance, FastifyReply } from "fastify";
import { EventsApiRoles } from "./roles.ts";
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    authorize: (
      request: FastifyRequest,
      reply: FastifyReply,
      validRoles: EventsApiRoles[],
    ) => Promise<void>;
    runEnvironment: string;
  }
  interface FastifyRequest {
    startTime: number;
  }
}
