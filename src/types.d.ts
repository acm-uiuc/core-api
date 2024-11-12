import { FastifyRequest, FastifyInstance, FastifyReply } from "fastify";
import { AppRoles, RunEnvironment } from "./roles.ts";
import { AadToken } from "./plugins/auth.ts";
import { ConfigType } from "./config.ts";
import { Sequelize } from "@sequelize/core";
import { PostgresDialect } from "@sequelize/postgres";

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
    ) => Promise<Set<AppRoles>>;
    zodValidateBody: (
      request: FastifyRequest,
      _reply: FastifyReply,
      zodSchema: Zod.ZodTypeAny,
    ) => Promise<void>;
    runEnvironment: RunEnvironment;
    environmentConfig: ConfigType;
    secretValue: Record<string, any> | null;
    sequelizeInstance: Sequelize | null;
  }
  interface FastifyRequest {
    startTime: number;
    username?: string;
    userRoles?: Set<string>;
    tokenPayload?: AadToken;
  }
}

export type NoDataRequest = {
  Params: undefined;
  Querystring: undefined;
  Body: undefined;
};
