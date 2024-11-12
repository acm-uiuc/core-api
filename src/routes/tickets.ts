import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { genericConfig } from "../config.js";
import {
  BaseError,
  DatabaseFetchError,
  TicketNotFoundError,
  TicketNotValidError,
  UnauthenticatedError,
  ValidationError,
} from "../errors/index.js";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { validateEmail } from "../functions/validation.js";
import { AppRoles } from "../roles.js";
import { zodToJsonSchema } from "zod-to-json-schema";

const postMerchSchema = z.object({
  type: z.literal("merch"),
  email: z.string().email(),
  stripePi: z.string().min(1),
});

const postTicketSchema = z.object({
  type: z.literal("ticket"),
  ticketId: z.string().min(1),
});

const purchaseSchema = z.object({
  email: z.string().email(),
  productId: z.string(),
  quantity: z.number().int().positive(),
  size: z.string().optional(),
});

type PurchaseData = z.infer<typeof purchaseSchema>;

const responseJsonSchema = zodToJsonSchema(
  z.object({
    valid: z.boolean(),
    type: z.enum(["merch", "ticket"]),
    ticketId: z.string().min(1),
    purchaserData: purchaseSchema,
  }),
);

const postSchema = z.union([postMerchSchema, postTicketSchema]);

type VerifyPostRequest = z.infer<typeof postSchema>;

const dynamoClient = new DynamoDBClient({
  region: genericConfig.AwsRegion,
});

const ticketsPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.post<{ Body: VerifyPostRequest }>(
    "/checkIn",
    {
      schema: {
        response: { 200: responseJsonSchema },
      },
      preValidation: async (request, reply) => {
        await fastify.zodValidateBody(request, reply, postSchema);
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.TICKET_SCANNER]);
      },
    },
    async (request, reply) => {
      let command: UpdateItemCommand;
      let ticketId: string;
      if (!request.username) {
        throw new UnauthenticatedError({ message: "Could not find username." });
      }
      switch (request.body.type) {
        case "merch":
          ticketId = request.body.stripePi;
          command = new UpdateItemCommand({
            TableName: genericConfig.MerchStorePurchasesTableName,
            Key: {
              stripe_pi: { S: ticketId },
            },
            UpdateExpression: "SET fulfilled = :true_val",
            ConditionExpression: "#email = :email_val",
            ExpressionAttributeNames: {
              "#email": "email",
            },
            ExpressionAttributeValues: {
              ":true_val": { BOOL: true },
              ":email_val": { S: request.body.email },
            },
            ReturnValues: "ALL_OLD",
          });
          break;
        case "ticket":
          ticketId = request.body.ticketId;
          command = new UpdateItemCommand({
            TableName: genericConfig.TicketPurchasesTableName,
            Key: {
              ticket_id: { S: ticketId },
            },
            UpdateExpression: "SET #used = :trueValue",
            ExpressionAttributeNames: {
              "#used": "used",
            },
            ExpressionAttributeValues: {
              ":trueValue": { BOOL: true },
            },
            ReturnValues: "ALL_OLD",
          });
          break;
        default:
          throw new ValidationError({ message: `Unknown verification type!` });
      }
      let purchaserData: PurchaseData;
      try {
        const ticketEntry = await dynamoClient.send(command);
        if (!ticketEntry.Attributes) {
          throw new DatabaseFetchError({
            message: "Could not find ticket data",
          });
        }
        const attributes = unmarshall(ticketEntry.Attributes);
        if (attributes["refunded"]) {
          throw new TicketNotValidError({
            message: "Ticket was already refunded.",
          });
        }
        if (attributes["used"] || attributes["fulfilled"]) {
          throw new TicketNotValidError({
            message: "Ticket has already been used.",
          });
        }
        if (request.body.type === "ticket") {
          const rawData = attributes["ticketholder_netid"];
          const isEmail = validateEmail(attributes["ticketholder_netid"]);
          purchaserData = {
            email: isEmail ? rawData : `${rawData}@illinois.edu`,
            productId: attributes["event_id"],
            quantity: 1,
          };
        } else {
          purchaserData = {
            email: attributes["email"],
            productId: attributes["item_id"],
            quantity: attributes["quantity"],
            size: attributes["size"],
          };
        }
      } catch (e: unknown) {
        if (!(e instanceof Error)) {
          throw e;
        }
        request.log.error(e);
        if (e instanceof BaseError) {
          throw e;
        }
        if (e.name === "ConditionalCheckFailedException") {
          throw new TicketNotFoundError({
            message: "Ticket does not exist",
          });
        }
        throw new DatabaseFetchError({
          message: "Could not set ticket to used - database operation failed",
        });
      }
      const response = {
        valid: true,
        type: request.body.type,
        ticketId,
        purchaserData,
      };
      switch (request.body.type) {
        case "merch":
          ticketId = request.body.stripePi;
          command = new UpdateItemCommand({
            TableName: genericConfig.MerchStorePurchasesTableName,
            Key: {
              stripe_pi: { S: ticketId },
            },
            UpdateExpression: "SET scannerEmail = :scanner_email",
            ConditionExpression: "email = :email_val",
            ExpressionAttributeValues: {
              ":scanner_email": { S: request.username },
              ":email_val": { S: request.body.email },
            },
          });
          break;
        case "ticket":
          ticketId = request.body.ticketId;
          command = new UpdateItemCommand({
            TableName: genericConfig.TicketPurchasesTableName,
            Key: {
              ticket_id: { S: ticketId },
            },
            UpdateExpression: "SET scannerEmail = :scanner_email",
            ExpressionAttributeValues: {
              ":scanner_email": { S: request.username },
            },
          });
          break;
        default:
          throw new ValidationError({ message: `Unknown verification type!` });
      }
      await dynamoClient.send(command);
      reply.send(response);
    },
  );
};

export default ticketsPlugin;
