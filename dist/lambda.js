import awsLambdaFastify from "@fastify/aws-lambda";
import init from "./index.js";
const app = init();
const handler = awsLambdaFastify(app, {
    decorateRequest: false,
    serializeLambdaArguments: true,
});
await app.ready();
export { handler };
