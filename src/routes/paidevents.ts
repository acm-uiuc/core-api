import fastify, { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
  ScanCommand,
  ScalarAttributeType,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import { ticketeventConfig, mercheventConfig } from "../config.js";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BaseError,
  DatabaseFetchError,
  DatabaseInsertError,
  ValidationError,
} from "../errors/index.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AppRoles } from "../roles.js";

const dynamoclient = new DynamoDBClient({
  region: ticketeventConfig.AwsRegion,
});

type EventGetRequest = {
  Params: { id: string };
  Querystring: undefined;
  Body: undefined;
};

type EventUpdateRequest = {
  Params: { id: string };
  Querystring: undefined;
  Body: { attribute: string; value: string };
};

/*const updateJsonSchema = zodToJsonSchema(
  z.object({
    event_id: z.number(),
    event_name: z.string(),
    eventCost: z.record(z.number()),
    eventDetails: z.optional(z.string()),
    eventImage: z.optional(z.string()),
    eventProps: z.record(z.string(), z.string()),
    event_capacity: z.number(),
    event_sales_active_utc: z.string(),
    event_time: z.number(),
    member_price: z.optional(z.string()),
    nonmember_price: z.optional(z.string()),
    tickets_sold: z.number()
  })
)*/

const responseJsonSchema = zodToJsonSchema(
  z.object({
    id: z.string(),
    resource: z.string(),
  }),
);

const paideventsPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get("/", (request, reply) => {
    reply.send({ Status: "Up" });
  });
  fastify.get("/ticketevents", async (request, reply) => {
    try {
      const response = await dynamoclient.send(
        new ScanCommand({
          TableName: ticketeventConfig.DynamoTableName,
        }),
      );
      const items = response.Items?.map((item) => unmarshall(item));
      reply
        .header(
          "cache-control",
          "public, max-age=7200, stale-while-revalidate=900, stale-if-error=86400",
        )
        .send(items);
    } catch (e: unknown) {
      if (e instanceof Error) {
        request.log.error("Failed" + e.toString());
      } else {
        request.log.error(`Failed to get from DynamoDB. ${e}`);
      }
      throw new DatabaseFetchError({
        message: "Failed to get events from Dynamo table.",
      });
    }
  });
  fastify.get("/merchevents", async (request, reply) => {
    try {
      const response = await dynamoclient.send(
        new ScanCommand({
          TableName: mercheventConfig.DynamoTableName,
        }),
      );
      const items = response.Items?.map((item) => unmarshall(item));
      reply
        .header(
          "cache-control",
          "public, max-age=7200, stale-while-revalidate=900, stale-if-error=86400",
        )
        .send(items);
    } catch (e: unknown) {
      if (e instanceof Error) {
        request.log.error("Failed" + e.toString());
      } else {
        request.log.error(`Failed to get from DynamoDB. ${e}`);
      }
      throw new DatabaseFetchError({
        message: "Failed to get events from Dynamo table.",
      });
    }
  });

  //helper get no validation
  fastify.get<EventGetRequest>(
    "/ticketevents/:id",
    async (request: FastifyRequest<EventGetRequest>, reply) => {
      const id = request.params.id;
      try {
        const response = await dynamoclient.send(
          new QueryCommand({
            TableName: ticketeventConfig.DynamoTableName,
            KeyConditionExpression: "event_id = :id",
            ExpressionAttributeValues: {
              ":id": { S: id },
            },
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

  fastify.get<EventGetRequest>(
    "/merchevents/:id",
    async (request: FastifyRequest<EventGetRequest>, reply) => {
      const id = request.params.id;
      try {
        const response = await dynamoclient.send(
          new QueryCommand({
            TableName: mercheventConfig.DynamoTableName,
            KeyConditionExpression: "item_id = :id",
            ExpressionAttributeValues: {
              ":id": { S: id },
            },
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

  fastify.put<EventUpdateRequest>(
    "/ticketevents/:id",
    {
      schema: {
        response: { 200: responseJsonSchema },
      },
      /*onRequest: async (request, reply) => {
            await fastify.authorize(request, reply, [AppRoles.EVENTS_MANAGER]);
          },*/ //Validation taken off for testing
    },
    async (request: FastifyRequest<EventUpdateRequest>, reply) => {
      try {
        const id = request.params.id;
        const attribute = request.body.attribute;
        const value = request.body.value;

        let valueExpression;
        const temp = Number(value);
        if (isNaN(temp)) {
          valueExpression = { S: value };
        } else {
          valueExpression = { N: value };
        }

        const response = await dynamoclient.send(
          new UpdateItemCommand({
            TableName: ticketeventConfig.DynamoTableName,
            Key: {
              event_id: { S: id },
            },
            ConditionExpression: "attribute_exists(#attr)",
            UpdateExpression: "SET #attr = :value",
            ExpressionAttributeNames: {
              "#attr": attribute,
            },
            ExpressionAttributeValues: {
              ":value": valueExpression,
            },
            ReturnValues: "ALL_NEW",
          }),
        );
        reply.send({
          id: id,
          resource: `/api/v1/paidevents/ticketevents/${id}`,
        });
      } catch (e: unknown) {
        if (e instanceof Error) {
          request.log.error("Failed to get from DynamoDB: " + e.toString());
        }
        if (e instanceof ConditionalCheckFailedException) {
          request.log.error("Attribute does not exist");
        }
        throw new DatabaseFetchError({
          message: "Failed to get event from Dynamo table.",
        });
      }
    },
  );

  //Multiple attribute udpates...

  fastify.put<EventUpdateRequest>(
    "/merchevents/:id",
    {
      schema: {
        response: { 200: responseJsonSchema },
      },
      /*onRequest: async (request, reply) => {
            await fastify.authorize(request, reply, [AppRoles.EVENTS_MANAGER]);
          },*/ //Validatison taken off for testing
    },
    async (request: FastifyRequest<EventUpdateRequest>, reply) => {
      try {
        const id = request.params.id;
        const attribute = request.body.attribute;
        const value = request.body.value;

        let valueExpression;
        const num = Number(value);
        if (isNaN(num)) {
          valueExpression = { S: value };
        } else {
          valueExpression = { N: value };
        }

        const response = await dynamoclient.send(
          new UpdateItemCommand({
            TableName: mercheventConfig.DynamoTableName,
            Key: {
              item_id: { S: id },
            },
            ConditionExpression: "attribute_exists(#attr)",
            UpdateExpression: "SET #attr = :value",
            ExpressionAttributeNames: {
              "#attr": attribute,
            },
            ExpressionAttributeValues: {
              ":value": valueExpression,
            },
            ReturnValues: "ALL_NEW",
          }),
        );
        reply.send({
          id: id,
          resource: `/api/v1/paidevents/merchevents/${id}`,
        });
      } catch (e: unknown) {
        if (e instanceof Error) {
          request.log.error("Failed to get from DynamoDB: " + e.toString());
        }
        if (e instanceof ConditionalCheckFailedException) {
          request.log.error("Attribute does not exist");
        }
        throw new DatabaseFetchError({
          message: "Failed to get event from Dynamo table.",
        });
      }
    },
  );
};

export default paideventsPlugin;
