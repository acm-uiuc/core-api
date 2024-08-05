/* eslint import/no-nodejs-modules: ["error", {"allow": ["crypto"]}] */
import { randomUUID } from "crypto";
import fastify, { FastifyInstance } from "fastify";
import FastifyAuthProvider from "@fastify/auth";
import fastifyAuthPlugin from "./plugins/auth.js";
import protectedRoute from "./routes/protected.js";

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
  await app.register(FastifyAuthProvider);
  app.runEnvironment = process.env.RunEnvironment ?? "dev";
  app.addHook("onRequest", (req, _, done) => {
    req.startTime = now();
    req.log.info({ url: req.raw.url }, "received request");
    done();
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
    },
    { prefix: "/api/v1" },
  );
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // local development
  const app = await init();
  app.listen({ port: 3000 }, (err) => {
    /* eslint no-console: ["error", {"allow": ["log", "error"]}] */
    if (err) console.error(err);
    console.log("Server listening on 3000");
  });
}
export default init;
