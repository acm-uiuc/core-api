import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AppRoles } from "../roles.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { OrganizationList } from "../orgs.js";
import {
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { genericConfig } from "../config.js";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BaseError,
  DatabaseFetchError,
  DatabaseInsertError,
  DiscordEventError,
} from "../errors/index.js";
import { randomUUID } from "crypto";
import moment from "moment-timezone";
import { IUpdateDiscord, updateDiscord } from "../functions/discord.js";

// POST

const repeatOptions = ["weekly", "biweekly"] as const;
export type EventRepeatOptions = (typeof repeatOptions)[number];

const baseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  start: z.string(),
  end: z.optional(z.string()),
  location: z.string(),
  locationLink: z.optional(z.string().url()),
  host: z.enum(OrganizationList as [string, ...string[]]),
  featured: z.boolean().default(false),
  paidEventId: z.optional(z.string().min(1)),
});

const requestSchema = baseSchema.extend({
  repeats: z.optional(z.enum(repeatOptions)),
  repeatEnds: z.string().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const postRequestSchema = requestSchema.refine(
  (data) => (data.repeatEnds ? data.repeats !== undefined : true),
  {
    message: "repeats is required when repeatEnds is defined",
  },
);

export type EventPostRequest = z.infer<typeof postRequestSchema>;
type EventGetRequest = {
  Params: { id: string };
  Querystring: undefined;
  Body: undefined;
};

const responseJsonSchema = zodToJsonSchema(
  z.object({
    id: z.string(),
    resource: z.string(),
  }),
);

// GET
const getEventSchema = requestSchema.extend({
  id: z.string(),
});

export type EventGetResponse = z.infer<typeof getEventSchema>;
const getEventJsonSchema = zodToJsonSchema(getEventSchema);

const getEventsSchema = z.array(getEventSchema);
export type EventsGetResponse = z.infer<typeof getEventsSchema>;
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
        await fastify.zodValidateBody(request, reply, postRequestSchema);
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.EVENTS_MANAGER]);
      },
    },
    async (request, reply) => {
      try {
        const entryUUID =
          (request.params as Record<string, string>).id ||
          randomUUID().toString();
        const entry = {
          ...request.body,
          id: entryUUID,
          createdBy: request.username,
        };
        await dynamoClient.send(
          new PutItemCommand({
            TableName: genericConfig.DynamoTableName,
            Item: marshall(entry),
          }),
        );

        try {
          if (request.body.featured && !request.body.repeats) {
            await updateDiscord(entry, false, request.log);
          }
        } catch (e: unknown) {
          // delete DB event if Discord fails.
          await dynamoClient.send(
            new DeleteItemCommand({
              TableName: genericConfig.DynamoTableName,
              Key: { id: { S: entryUUID } },
            }),
          );
          if (e instanceof Error) {
            request.log.error(`Failed to publish event to Discord: ${e}`);
          }
          if (e instanceof BaseError) {
            throw e;
          }
          throw new DiscordEventError({});
        }

        reply.send({
          id: entryUUID,
          resource: `/api/v1/event/${entryUUID}`,
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
  fastify.get<EventGetRequest>(
    "/:id",
    {
      schema: {
        response: { 200: getEventJsonSchema },
      },
    },
    async (request: FastifyRequest<EventGetRequest>, reply) => {
      const id = request.params.id;
      try {
        const response = await dynamoClient.send(
          new ScanCommand({
            TableName: genericConfig.DynamoTableName,
            FilterExpression: "#id = :id",
            ExpressionAttributeNames: {
              "#id": "id",
            },
            ExpressionAttributeValues: marshall({ ":id": id }),
          }),
        );
        const items = response.Items?.map((item) => unmarshall(item));
        if (items?.length !== 1) {
          throw new Error("Event not found");
        }
        reply.send(items[0]);
      } catch (e: unknown) {
        if (e instanceof Error) {
          request.log.error("Failed to get from DynamoDB: " + e.toString());
        }
        throw new DatabaseFetchError({
          message: "Failed to get event from Dynamo table.",
        });
      }
    },
  );
  type EventDeleteRequest = {
    Params: { id: string };
    Querystring: undefined;
    Body: undefined;
  };
  fastify.delete<EventDeleteRequest>(
    "/:id",
    {
      schema: {
        response: { 200: responseJsonSchema },
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.EVENTS_MANAGER]);
      },
    },
    async (request: FastifyRequest<EventDeleteRequest>, reply) => {
      const id = request.params.id;
      try {
        await dynamoClient.send(
          new DeleteItemCommand({
            TableName: genericConfig.DynamoTableName,
            Key: marshall({ id }),
          }),
        );
        await updateDiscord({ id } as IUpdateDiscord, true, request.log);
        reply.send({
          id,
          resource: `/api/v1/event/${id}`,
        });
      } catch (e: unknown) {
        if (e instanceof Error) {
          request.log.error("Failed to delete from DynamoDB: " + e.toString());
        }
        throw new DatabaseInsertError({
          message: "Failed to delete event from Dynamo table.",
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
        response: { 200: getEventsSchema },
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
        let parsedItems = getEventsSchema.parse(items);
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
        } else {
          request.log.error(`Failed to get from DynamoDB. ${e}`);
        }
        throw new DatabaseFetchError({
          message: "Failed to get events from Dynamo table.",
        });
      }
    },
  );
};

export default eventsPlugin;
