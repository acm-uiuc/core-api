/* eslint-disable */

import awsLambdaFastify from "@fastify/aws-lambda";
import init from "./index.js";

const app = await init();
let handler = () => {};
if (import.meta.url === `file://${process.argv[1]}`) {
  // local development
  app.listen({ port: 8080 }, (err) => {
    /* eslint no-console: ["error", {"allow": ["log", "error"]}] */
    if (err) console.error(err);
    console.log("Server listening on 8080");
  });
} else {
  const handler = awsLambdaFastify(app, {
    decorateRequest: false,
    serializeLambdaArguments: true,
  });
  await app.ready(); // needs to be placed after awsLambdaFastify call because of the decoration: https://github.com/fastify/aws-lambda-fastify/blob/master/index.js#L9
}
export { handler, app };
