import { FastifyPluginAsync } from "fastify";
import { AppRoles } from "../roles.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { OrganizationList } from "../orgs.js";
import {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import config from "../config.js";
import { DatabaseFetchError, DatabaseInsertError } from "../errors/index.js";
import { randomUUID } from "crypto";

// POST

const repeatOptions = ["weekly", "biweekly"] as const;

const baseBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  start: z.string(),
  end: z.optional(z.string()),
  location: z.string(),
  locationLink: z.optional(z.string().url()),
  host: z.enum(OrganizationList),
  featured: z.boolean().default(false),
});

const requestBodySchema = baseBodySchema
  .extend({
    repeats: z.optional(z.enum(repeatOptions)),
    repeatEnds: z.string().optional(),
  })
  .refine((data) => (data.repeatEnds ? data.repeats !== undefined : true), {
    message: "repeats is required when repeatEnds is defined",
  });

type EventPostRequest = z.infer<typeof requestBodySchema>;

const responseJsonSchema = zodToJsonSchema(
  z.object({
    id: z.string(),
    resource: z.string(),
  }),
);

// GET
const getResponseBodySchema = z.array(requestBodySchema);
const getResponseJsonSchema = zodToJsonSchema(getResponseBodySchema);

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const eventsPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.post<{ Body: EventPostRequest }>(
    "/:id?",
    {
      schema: {
        response: { 200: responseJsonSchema },
      },
      preValidation: async (request, reply) => {
        await fastify.zodValidateBody(request, reply, requestBodySchema);
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.MANAGER]);
      },
    },
    async (request, reply) => {
      try {
        const entryUUID =
          (request.params as Record<string, string>).id ||
          randomUUID().toString();
        await dynamoClient.send(
          new PutItemCommand({
            TableName: config.DYNAMO_TABLE_NAME,
            Item: marshall({
              ...request.body,
              id: entryUUID,
              createdBy: request.username,
            }),
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
  fastify.get<{ Body: undefined }>(
    "/",
    {
      schema: {
        response: { 200: getResponseJsonSchema },
      },
    },
    async (request, reply) => {
      try {
        const response = await dynamoClient.send(
          new ScanCommand({ TableName: config.DYNAMO_TABLE_NAME }),
        );
        const items = response.Items?.map((item) => unmarshall(item));
        reply.send(getResponseBodySchema.parse(items));
      } catch (e: unknown) {
        if (e instanceof Error) {
          request.log.error("Failed to get from DynamoDB: " + e.toString());
        }
        throw new DatabaseFetchError({
          message: "Failed to get events from Dynamo table.",
        });
      }
    },
  );
};

export default eventsPlugin;
