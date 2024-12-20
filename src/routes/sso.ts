import { FastifyPluginAsync } from "fastify";
import { AppRoles } from "../roles.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { addToTenant, getEntraIdToken } from "../functions/entraId.js";
import { EntraInvitationError, InternalServerError } from "../errors/index.js";

const invitePostRequestSchema = z.object({
  emails: z.array(z.string()),
});
export type InviteUserPostRequest = z.infer<typeof invitePostRequestSchema>;

const invitePostResponseSchema = zodToJsonSchema(
  z.object({
    success: z.array(z.object({ email: z.string() })).optional(),
    failure: z
      .array(z.object({ email: z.string(), message: z.string() }))
      .optional(),
  }),
);

const ssoManagementRoute: FastifyPluginAsync = async (fastify, _options) => {
  fastify.post<{ Body: InviteUserPostRequest }>(
    "/inviteUsers",
    {
      schema: {
        response: { 200: invitePostResponseSchema },
      },
      preValidation: async (request, reply) => {
        await fastify.zodValidateBody(request, reply, invitePostRequestSchema);
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.SSO_INVITE_USER]);
      },
    },
    async (request, reply) => {
      const emails = request.body.emails;
      const entraIdToken = await getEntraIdToken(
        fastify.environmentConfig.AadValidClientId,
      );
      if (!entraIdToken) {
        throw new InternalServerError({
          message: "Could not get Entra ID token to perform task.",
        });
      }
      const response: Record<string, Record<string, string>[]> = {
        success: [],
        failure: [],
      };
      const results = await Promise.allSettled(
        emails.map((email) => addToTenant(entraIdToken, email)),
      );
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          response.success.push({ email: emails[i] });
        } else {
          if (result.reason instanceof EntraInvitationError) {
            response.failure.push({
              email: emails[i],
              message: result.reason.message,
            });
          }
        }
      }
      let statusCode = 201;
      if (response.success.length === 0) {
        statusCode = 500;
      }
      reply.status(statusCode).send(response);
    },
  );
};

export default ssoManagementRoute;
