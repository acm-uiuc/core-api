import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwksClient from "jwks-rsa";
import jwt, { Algorithm } from "jsonwebtoken";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { AppRoles } from "../roles.js";
import {
  BaseError,
  InternalServerError,
  UnauthenticatedError,
  UnauthorizedError,
} from "../errors/index.js";
import { environmentConfig, genericConfig } from "../config.js";

function intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const _intersection = new Set<T>();
  for (const elem of setB) {
    if (setA.has(elem)) {
      _intersection.add(elem);
    }
  }
  return _intersection;
}

export type AadToken = {
  aud: string;
  iss: string;
  iat: number;
  nbf: number;
  exp: number;
  acr: string;
  aio: string;
  amr: string[];
  appid: string;
  appidacr: string;
  email?: string;
  groups?: string[];
  idp: string;
  ipaddr: string;
  name: string;
  oid: string;
  rh: string;
  scp: string;
  sub: string;
  tid: string;
  unique_name: string;
  uti: string;
  ver: string;
  roles?: string[];
};
const smClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const getSecretValue = async (
  secretId: string,
): Promise<Record<string, string | number | boolean> | null> => {
  const data = await smClient.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );
  if (!data.SecretString) {
    return null;
  }
  try {
    return JSON.parse(data.SecretString) as Record<
      string,
      string | number | boolean
    >;
  } catch {
    return null;
  }
};

const authPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.decorate(
    "authorize",
    async function (
      request: FastifyRequest,
      _reply: FastifyReply,
      validRoles: AppRoles[],
    ): Promise<void> {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          throw new UnauthenticatedError({
            message: "Did not find bearer token in expected header.",
          });
        }
        const [method, token] = authHeader.split(" ");
        if (method !== "Bearer") {
          throw new UnauthenticatedError({
            message: `Did not find bearer token, found ${method} token.`,
          });
        }
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const decoded = jwt.decode(token, { complete: true }) as Record<
          string,
          any
        >;
        let signingKey = "";
        let verifyOptions = {};
        if (decoded?.payload.iss === "custom_jwt") {
          if (fastify.runEnvironment === "prod") {
            throw new UnauthenticatedError({
              message: "Custom JWTs cannot be used in Prod environment.",
            });
          }
          signingKey =
            process.env.JwtSigningKey ||
            ((
              (await getSecretValue(genericConfig.ConfigSecretName)) || {
                jwt_key: "",
              }
            ).jwt_key as string) ||
            "";
          if (signingKey === "") {
            throw new UnauthenticatedError({
              message: "Invalid token.",
            });
          }
          verifyOptions = { algorithms: ["HS256" as Algorithm] };
        } else {
          const AadClientId = process.env.AadValidClientId;
          if (!AadClientId) {
            request.log.error(
              "Server is misconfigured, could not find `AadValidClientId`!",
            );
            throw new InternalServerError({
              message:
                "Server authentication is misconfigured, please contact your administrator.",
            });
          }
          const header = decoded?.header;
          if (!header) {
            throw new UnauthenticatedError({
              message: "Could not decode token header.",
            });
          }
          verifyOptions = {
            algorithms: ["RS256" as Algorithm],
            header: decoded?.header,
            audience: `api://${AadClientId}`,
          };
          const client = jwksClient({
            jwksUri: "https://login.microsoftonline.com/common/discovery/keys",
          });
          signingKey = (await client.getSigningKey(header.kid)).getPublicKey();
        }

        const verifiedTokenData = jwt.verify(
          token,
          signingKey,
          verifyOptions,
        ) as AadToken;
        request.tokenPayload = verifiedTokenData;
        request.username = verifiedTokenData.email || verifiedTokenData.sub;
        const userRoles = new Set([] as AppRoles[]);
        const expectedRoles = new Set(validRoles);
        if (verifiedTokenData.groups) {
          for (const group of verifiedTokenData.groups) {
            if (
              !environmentConfig[fastify.runEnvironment]["GroupRoleMapping"][
                group
              ]
            ) {
              continue;
            }
            for (const role of environmentConfig[fastify.runEnvironment][
              "GroupRoleMapping"
            ][group]) {
              userRoles.add(role);
            }
          }
        } else {
          if (verifiedTokenData.roles) {
            for (const group of verifiedTokenData.roles) {
              if (
                !environmentConfig[fastify.runEnvironment]["AzureRoleMapping"][
                  group
                ]
              ) {
                continue;
              }
              for (const role of environmentConfig[fastify.runEnvironment][
                "AzureRoleMapping"
              ][group]) {
                userRoles.add(role);
              }
            }
          } else {
            throw new UnauthenticatedError({
              message: "Could not find groups or roles in token.",
            });
          }
        }
        if (intersection(userRoles, expectedRoles).size === 0) {
          throw new UnauthorizedError({
            message: "User does not have the privileges for this task.",
          });
        }
      } catch (err: unknown) {
        if (err instanceof BaseError) {
          throw err;
        }
        if (err instanceof jwt.TokenExpiredError) {
          throw new UnauthenticatedError({
            message: "Token has expired.",
          });
        }
        if (err instanceof Error) {
          request.log.error(`Failed to verify JWT: ${err.toString()}`);
        }
        throw new UnauthenticatedError({
          message: "Invalid token.",
        });
      }
    },
  );
};

const fastifyAuthPlugin = fp(authPlugin);
export default fastifyAuthPlugin;
