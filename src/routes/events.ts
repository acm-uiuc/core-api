import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AppRoles } from "../roles.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { OrganizationList } from "../orgs.js";
import {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { genericConfig } from "../config.js";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { DatabaseFetchError, DatabaseInsertError } from "../errors/index.js";
import { randomUUID } from "crypto";
import moment from "moment-timezone";

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
type EventsGetQueryParams = { upcomingOnly?: boolean };

const dynamoClient = new DynamoDBClient({
  region: genericConfig.AwsRegion,
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
            TableName: genericConfig.DynamoTableName,
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
  type EventsGetRequest = {
    Body: undefined;
    Querystring?: EventsGetQueryParams;
  };
  fastify.get<EventsGetRequest>(
    "/",
    {
      schema: {
        querystring: {
          upcomingOnly: { type: "boolean" },
        },
        response: { 200: getResponseJsonSchema },
      },
    },
    async (request: FastifyRequest<EventsGetRequest>, reply) => {
      const upcomingOnly = request.query?.upcomingOnly || false;
      try {
        const response = await dynamoClient.send(
          new ScanCommand({ TableName: genericConfig.DynamoTableName }),
        );
        const items = response.Items?.map((item) => unmarshall(item));
        const currentTimeChicago = moment().tz("America/Chicago");
        let parsedItems = getResponseBodySchema.parse(items);
        if (upcomingOnly) {
          parsedItems = parsedItems.filter((item) => {
            try {
              if (item.repeats && !item.repeatEnds) {
                return true;
              }
              if (!item.repeats) {
                const end = item.end || item.start;
                const momentEnds = moment.tz(end, "America/Chicago");
                const diffTime = currentTimeChicago.diff(momentEnds);
                return Boolean(
                  diffTime <= genericConfig.UpcomingEventThresholdSeconds,
                );
              }
              const momentRepeatEnds = moment.tz(
                item.repeatEnds,
                "America/Chicago",
              );
              const diffTime = currentTimeChicago.diff(momentRepeatEnds);
              return Boolean(
                diffTime <= genericConfig.UpcomingEventThresholdSeconds,
              );
            } catch (e: unknown) {
              request.log.warn(
                `Could not compute upcoming event status for event ${item.title}: ${e instanceof Error ? e.toString() : e}`,
              );
              return false;
            }
          });
        }
        reply.send(parsedItems);
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
