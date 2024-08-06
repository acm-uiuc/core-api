import { FastifyPluginAsync } from "fastify";
import { AppRoles } from "../roles.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { OrganizationList } from "../orgs.js";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import config from "../config.js";
import { DatabaseInsertError } from "../errors/index.js";
import { randomUUID } from "crypto";

const repeatOptions = ["weekly", "biweekly"] as const;

const requestBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  start: z.string().datetime(),
  end: z.optional(z.string().datetime()),
  location: z.string(),
  locationLink: z.optional(z.string().url()),
  repeats: z.optional(z.enum(repeatOptions)),
  host: z.enum(OrganizationList),
});
const requestJsonSchema = zodToJsonSchema(requestBodySchema);
type EventPostRequest = z.infer<typeof requestBodySchema>;

const responseJsonSchema = zodToJsonSchema(
  z.object({
    id: z.string(),
    resource: z.string(),
  }),
);

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const createEvent: FastifyPluginAsync = async (fastify, _options) => {
  fastify.post<{ Body: EventPostRequest }>(
    "/",
    {
      schema: {
        body: requestJsonSchema,
        response: { 200: responseJsonSchema },
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.MANAGER]);
      },
    },
    async (request, reply) => {
      try {
        const entryUUID = randomUUID().toString();
        const dynamoResponse = await dynamoClient.send(
          new PutItemCommand({
            TableName: config.DYNAMO_TABLE_NAME,
            Item: marshall({ ...request.body, id: entryUUID }),
          }),
        );
        reply.send({
          id: entryUUID,
          resource: `/api/v1/entry/${entryUUID}`,
        });
      } catch (e: unknown) {
        if (e instanceof Error) {
          request.log.error("Failed to insert to DynamoDB: " + e.toString());
        }
        throw new DatabaseInsertError({
          message: "Failed to insert event to Dynamo table.",
        });
      }
    },
  );
};

export default createEvent;
