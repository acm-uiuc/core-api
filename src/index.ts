/* eslint import/no-nodejs-modules: ["error", {"allow": ["crypto"]}] */
import { randomUUID } from "crypto";
import fastify, { FastifyInstance } from "fastify";
import FastifyAuthProvider from "@fastify/auth";
import fastifyAuthPlugin, { getSecretValue } from "./plugins/auth.js";
import protectedRoute from "./routes/protected.js";
import errorHandlerPlugin from "./plugins/errorHandler.js";
import { RunEnvironment, runEnvironments } from "./roles.js";
import { InternalServerError } from "./errors/index.js";
import eventsPlugin from "./routes/events.js";
import cors from "@fastify/cors";
import fastifyZodValidationPlugin from "./plugins/validate.js";
import { environmentConfig, genericConfig } from "./config.js";
import organizationsPlugin from "./routes/organizations.js";
import icalPlugin from "./routes/ics.js";
import vendingPlugin from "./routes/vending.js";
import linkryPlugin from "./routes/linkry.js";
import * as dotenv from "dotenv";
import { getSequelizeInstance } from "./functions/database.js";
dotenv.config();

const now = () => Date.now();

async function init() {
  const app: FastifyInstance = fastify({
    logger: true,
    disableRequestLogging: true,
    genReqId: (request) => {
      const header = request.headers["x-apigateway-event"];
      if (!header) {
        return randomUUID().toString();
      }
      const typeCheckedHeader = Array.isArray(header) ? header[0] : header;
      const event = JSON.parse(decodeURIComponent(typeCheckedHeader));
      return event.requestContext.requestId;
    },
  });
  await app.register(fastifyAuthPlugin);
  await app.register(fastifyZodValidationPlugin);
  await app.register(FastifyAuthProvider);
  await app.register(errorHandlerPlugin);
  if (!process.env.RunEnvironment) {
    process.env.RunEnvironment = "dev";
  }
  if (!runEnvironments.includes(process.env.RunEnvironment as RunEnvironment)) {
    throw new InternalServerError({
      message: `Invalid run environment ${app.runEnvironment}.`,
    });
  }
  app.runEnvironment = process.env.RunEnvironment as RunEnvironment;
  app.environmentConfig = environmentConfig[app.runEnvironment];
  app.secretValue = null;
  app.sequelizeInstance = null;
  app.addHook("onRequest", async (req, _) => {
    if (!app.secretValue) {
      app.secretValue =
        (await getSecretValue(genericConfig.ConfigSecretName)) || {};
    }
    if (!app.sequelizeInstance) {
      app.sequelizeInstance = await getSequelizeInstance(app);
    }
    req.startTime = now();
    req.log.info({ url: req.raw.url }, "received request");
  });
  app.addHook("onResponse", (req, reply, done) => {
    req.log.info(
      {
        url: req.raw.url,
        statusCode: reply.raw.statusCode,
        durationMs: now() - req.startTime,
      },
      "request completed",
    );
    done();
  });
  app.get("/api/v1/healthz", (_, reply) => reply.send({ message: "UP" }));
  await app.register(
    async (api, _options) => {
      api.register(protectedRoute, { prefix: "/protected" });
      api.register(eventsPlugin, { prefix: "/events" });
      api.register(organizationsPlugin, { prefix: "/organizations" });
      api.register(icalPlugin, { prefix: "/ical" });
      api.register(linkryPlugin, { prefix: "/linkry" });
      if (app.runEnvironment === "dev") {
        api.register(vendingPlugin, { prefix: "/vending" });
      }
    },
    { prefix: "/api/v1" },
  );
  await app.register(cors, {
    origin: app.environmentConfig.ValidCorsOrigins,
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // local development
  const app = await init();
  app.listen({ port: 8080 }, (err) => {
    /* eslint no-console: ["error", {"allow": ["log", "error"]}] */
    if (err) console.error(err);
    console.log("Server listening on 8080");
  });
}
export default init;
