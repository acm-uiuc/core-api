import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { BaseError, InternalServerError, UnauthenticatedError, UnauthorizedError } from "../errors/index.js";
import { AppRoles, RunEnvironment, runEnvironments } from "../roles.js";
import jwksClient, {JwksClient} from "jwks-rsa";
import jwt, { Algorithm } from "jsonwebtoken";

const GroupRoleMapping: Record<RunEnvironment, Record<string, AppRoles[]>> = {
  "prod": {"48591dbc-cdcb-4544-9f63-e6b92b067e33": [AppRoles.MANAGER]}, // Infra Chairs
  "dev": {"48591dbc-cdcb-4544-9f63-e6b92b067e33": [AppRoles.MANAGER]}, // Infra Chairs
};


function intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  let _intersection = new Set<T>();
  for (let elem of setB) {
      if (setA.has(elem)) {
          _intersection.add(elem);
      }
  }
  return _intersection;
}


type AadToken = {
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
  email: string;
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
}

const authPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.decorate(
    "authorize",
    async function (
      request: FastifyRequest,
      _reply: FastifyReply,
      validRoles: AppRoles[],
    ): Promise<void> {
      try {
        const AadClientId = process.env.AadValidClientId;
        if (!AadClientId) {
          request.log.error("Server is misconfigured, could not find `AadValidClientId`!")
          throw new InternalServerError({message: "Server authentication is misconfigured, please contact your administrator."});
        }
        const authHeader = request.headers['authorization']
        if (!authHeader) {
          throw new UnauthenticatedError({"message": "Did not find bearer token in expected header."})
        }
        const [method, token] = authHeader.split(" ");
        if (method != "Bearer") {
          throw new UnauthenticatedError({"message": `Did not find bearer token, found ${method} token.`})
        }
        const decoded = jwt.decode(token, {complete: true})
        const header = decoded?.header;
        if (!header) {
          throw new UnauthenticatedError({"message": "Could not decode token header."});
        }
        const verifyOptions = {algorithms: ['RS256' as Algorithm], header: decoded?.header, audience: `api://${AadClientId}`}
        const client = jwksClient({
          jwksUri: 'https://login.microsoftonline.com/common/discovery/keys'
        });
        const signingKey = (await client.getSigningKey(header.kid)).getPublicKey();
        const verifiedTokenData = jwt.verify(token, signingKey, verifyOptions) as AadToken;
        request.username = verifiedTokenData.email;
        const userRoles = new Set([] as AppRoles[]);
        const expectedRoles = new Set(validRoles)
        if (verifiedTokenData.groups) {
          for (const group of verifiedTokenData.groups) {
            if (!GroupRoleMapping[fastify.runEnvironment][group]) {
              continue;
            }
            for (const role of GroupRoleMapping[fastify.runEnvironment][group]) {
              userRoles.add(role);
            }
          }
        } else {
          throw new UnauthenticatedError({message: "Could not find groups in token."})
        }
        if (intersection(userRoles, expectedRoles).size === 0) {
          throw new UnauthorizedError({message: "User does not have the privileges for this task."})
        }
      } catch (err: unknown) {
        if (err instanceof BaseError) {
          throw err;
        }
        if (err instanceof Error) {
          request.log.error("Failed to verify JWT: " + err.toString())
        }
        throw new UnauthenticatedError({
          message: "Could not authenticate from token.",
        });
      }
    },
  );
};

const fastifyAuthPlugin = fp(authPlugin);
export default fastifyAuthPlugin;
