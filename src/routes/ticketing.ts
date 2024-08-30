import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AppRoles } from "../roles.js";
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { genericConfig } from "../config.js";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BaseError,
  DatabaseFetchError,
  DatabaseInsertError,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from "../errors/index.js";
import { randomUUID } from "crypto";
import moment from "moment-timezone";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { getSecretValue } from "../plugins/auth.js";
import * as crypto from "crypto";
import { checkMembershipStatus } from "../functions/membership.js";
import Stripe from "stripe";

const dynamoClient = new DynamoDBClient({
  region: genericConfig.AwsRegion,
});
const smClient = new SecretsManagerClient({
  region: genericConfig.AwsRegion,
});

const queryStringJsonSchema = {
  type: "object",
  properties: {
    netid: { type: "string" },
    eventid: { type: "string" },
  },
  required: ["netid", "eventid"],
};

const ticketingConfig = await getSecretValue(
  genericConfig.TicketingConfig.SecretName,
);
if (!ticketingConfig || !ticketingConfig["STRIPE_KEY"]) {
  throw new InternalServerError({ message: "Credentials not found." });
}
const stripeClient = new Stripe(ticketingConfig["STRIPE_KEY"] as string);

function getTicketId(eventId: string, netId: string): string {
  const data = "acm_event" + eventId + netId;
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

async function createStripeCheckoutSession(
  eventId: string,
  netId: string,
  priceId: string,
) {
  const session = await stripeClient.checkout.sessions.create({
    success_url: `https://acm.illinois.edu/#/event-paid/${eventId}`,
    cancel_url: `https://acm.illinois.edu/#/event/${eventId}`,
    customer_email: `${netId}@illinois.edu`,
    metadata: { event_id: eventId },
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "payment",
  });
  return session.url;
}

const ticketingPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get<{
    Body: undefined;
    Querystring: { netid: string; eventid: string };
  }>(
    "/checkout/session",
    { schema: { querystring: queryStringJsonSchema } },
    async (request, reply) => {
      if (!ticketingConfig) {
        request.log.error("Ticketing Config secret is null!");
        throw new InternalServerError({
          message: "Could not retreive configuration data.",
        });
      }
      const { eventid: eventId, netid: netId } = request.query;
      let eventsResponse;
      try {
        // check if there are tickets available.
        const response = await dynamoClient.send(
          new GetItemCommand({
            TableName: genericConfig.TicketingConfig.EventsTable,
            Key: { event_id: { S: eventId } },
            ProjectionExpression:
              "event_capacity,tickets_sold,nonmember_price,member_price",
          }),
        );
        if (!response || !response.Item) {
          throw new ValidationError({ message: "Event ID is not valid." });
        }
        eventsResponse = unmarshall(response.Item);
        if (
          eventsResponse["event_capacity"] <= eventsResponse["tickets_sold"]
        ) {
          return reply.send("Tickets are sold out.");
        }

        // check if ticket has already been issued
        const ticketsResponse = await dynamoClient.send(
          new GetItemCommand({
            TableName: genericConfig.TicketingConfig.TicketsTable,
            Key: { ticket_id: { S: getTicketId(eventId, netId) } },
            ProjectionExpression: "used",
          }),
        );

        if (ticketsResponse.Item && !ticketsResponse.Item["used"]) {
          return reply.send(
            `A valid ticket has already been issued for NetID ${netId}.`,
          );
        }
      } catch (e) {
        if (e instanceof BaseError) {
          throw e;
        }
        request.log.error(e);
        throw new DatabaseFetchError({
          message: "Could not perform validation checks. Please try again.",
        });
      }
      let isPaidMember: boolean = false;
      try {
        // get memebership status
        isPaidMember = await checkMembershipStatus(netId);
      } catch (e) {
        request.log.error(`Failed to get membership status: ${e}`);
      }
      const priceId = isPaidMember
        ? eventsResponse["member_price"]
        : eventsResponse["nonmember_price"];
      try {
        const url = await createStripeCheckoutSession(eventId, netId, priceId);
        if (!url) {
          throw new Error();
        }
        return reply.send(url);
      } catch (e) {
        if (e instanceof BaseError) {
          throw e;
        }
        request.log.error(`Failed to create Stripe checkout session: ${e}`);
        throw new InternalServerError({
          message: "Could not create checkout session. Please try again.",
        });
      }
    },
  );
};

export default ticketingPlugin;
