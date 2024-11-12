import { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  getSequelizeInstance,
  setSequelizeLogger,
} from "../functions/database.js";
import { ShortLinkModel } from "../models/linkry.model.js";
import { z } from "zod";
import { AppRoles } from "../roles.js";
import {
  BaseError,
  DatabaseDeleteError,
  DatabaseFetchError,
  DatabaseInsertError,
  InternalServerError,
  NotFoundError,
  UnauthenticatedError,
  UnauthorizedError,
  ValidationError,
} from "../errors/index.js";
import { UniqueConstraintError } from "@sequelize/core";
import { intersection } from "../plugins/auth.js";
import { NoDataRequest } from "../types.js";

type LinkrySlugOnlyRequest = {
  Params: { id: string };
  Querystring: undefined;
  Body: undefined;
};

const rawRequest = {
  slug: z.string().min(1),
  full: z.string().url().min(1),
  groups: z.optional(z.array(z.string()).min(1)),
};

const createRequest = z.object(rawRequest);
const patchRequest = z.object({ ...rawRequest, slug: z.undefined() });
// todo: patchRequest is all optional

type LinkyCreateRequest = {
  Params: undefined;
  Querystring: undefined;
  Body: z.infer<typeof createRequest>;
};

type LinkryPatchRequest = {
  Params: { id: string };
  Querystring: undefined;
  Body: z.infer<typeof patchRequest>;
};

function userCanManageLink(
  request: FastifyRequest,
  link: ShortLinkModel,
): boolean {
  if (request.userRoles?.has(AppRoles.LINKS_ADMIN)) {
    return true;
  }
  if (request.username === link.author) {
    return true;
  }
  if (!link.groups) {
    return false;
  }
  if (
    request.userRoles &&
    intersection(request.userRoles, new Set(link.groups))
  ) {
    return true;
  }
  return false;
}

const linkryRoutes: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get<LinkrySlugOnlyRequest>("/redir/:id", async (request, reply) => {
    // update logger instance
    setSequelizeLogger(request.log.debug, request.log.fatal);
    const slug = request.params.id;
    try {
      const result = await ShortLinkModel.findByPk(slug);
      if (!result) {
        const isProd = fastify.runEnvironment === "prod";
        // hide the real URL from the user in prod
        throw new NotFoundError({
          endpointName: isProd ? `/${slug}` : `/api/v1/linkry/redir/${slug}`,
        });
      } else {
        reply.redirect(result.full);
      }
    } catch (e) {
      if (e instanceof BaseError) {
        throw e;
      }
      request.log.error(`Failed to retrieve short link: ${e}`);
      throw new DatabaseFetchError({
        message: "Could not fetch short link entry.",
      });
    }
  });
  fastify.post<LinkyCreateRequest>(
    "/redir",
    {
      preValidation: async (request, reply) => {
        await fastify.zodValidateBody(request, reply, createRequest);
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.LINKS_MANAGER]);
      },
    },
    async (request, reply) => {
      // update logger instance
      setSequelizeLogger(request.log.debug, request.log.fatal);
      const slug = request.body.slug;
      if (!request.username) {
        throw new UnauthenticatedError({
          message: "Could not determine username.",
        });
      }
      try {
        await ShortLinkModel.create({
          ...request.body,
          author: request.username,
        });
      } catch (e) {
        if (e instanceof BaseError) {
          throw e;
        }
        if (e instanceof UniqueConstraintError) {
          throw new ValidationError({
            message: "This slug already exists, you must PATCH it directly.",
          });
        }
        request.log.error(`Failed to insert short link: ${e}`);
        throw new DatabaseInsertError({
          message: "Could not create short link entry.",
        });
      }
      return reply.send({
        message: "Short link created.",
        slug,
        resource: `/api/v1/linkry/redir/${slug}`,
      });
    },
  );
  fastify.patch<LinkryPatchRequest>(
    "/redir/:id",
    {
      preValidation: async (request, reply) => {
        await fastify.zodValidateBody(request, reply, patchRequest);
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.LINKS_MANAGER]);
      },
    },
    async (request, reply) => {
      // update logger instance
      setSequelizeLogger(request.log.debug, request.log.fatal);
      const slug = request.params.id;
      let result;
      try {
        result = await ShortLinkModel.findByPk(slug);
        if (!result) {
          const isProd = fastify.runEnvironment === "prod";
          // hide the real URL from the user in prod
          throw new NotFoundError({
            endpointName: isProd ? `/${slug}` : `/api/v1/linkry/redir/${slug}`,
          });
        }
      } catch (e) {
        if (e instanceof BaseError) {
          throw e;
        }
        request.log.error(`Failed to retrieve short link when modifying: ${e}`);
        throw new DatabaseFetchError({
          message: "Could not fetch short link entry.",
        });
      }
      if (!userCanManageLink(request, result)) {
        throw new UnauthenticatedError({
          message: "User cannot manage this link.",
        });
      }
      try {
        result.set({ ...request.body, slug: undefined });
        await result.save();
      } catch (e) {
        request.log.error(`Failed to modify short link ${slug}: ${e}`);
        throw new DatabaseInsertError({
          message: "Failed to modify short link.",
        });
      }
      reply.send({
        message: "Short link modified.",
        slug,
        resource: `/api/v1/linkry/redir/${slug}`,
      });
    },
  );
  fastify.delete<LinkrySlugOnlyRequest>(
    "/redir/:id",
    {
      preValidation: async (request, reply) => {
        await fastify.zodValidateBody(request, reply, createRequest);
      },
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.LINKS_MANAGER]);
      },
    },
    async (request, reply) => {
      // update logger instance
      if (!request.username) {
        throw new UnauthenticatedError({
          message: "Could not determine username.",
        });
      }
      let result;
      try {
        result = await ShortLinkModel.findByPk(request.params.id);
        if (!result) {
          throw new NotFoundError({
            endpointName: `/api/v1/linkry/redir/${request.params.id}`,
          });
        }
        if (!userCanManageLink(request, result)) {
          throw new UnauthenticatedError({
            message: "User cannot manage this link.",
          });
        }
      } catch (e) {
        if (e instanceof BaseError) {
          throw e;
        }
        request.log.error(
          `Could not fetch original link entry to delete it: ${e}`,
        );
        throw new DatabaseFetchError({
          message: `Could not fetch original link entry to delete it.`,
        });
      }

      try {
        await result.destroy();
      } catch (e) {
        if (e instanceof BaseError) {
          throw e;
        }
        request.log.error(`Could not delete short link entry: ${e}`);
        throw new DatabaseDeleteError({
          message: `Could not delete short link entry.`,
        });
      }
      reply.send({ message: "Short link deleted." });
    },
  );
  fastify.get<NoDataRequest>(
    "/redirs",
    {
      onRequest: async (request, reply) => {
        await fastify.authorize(request, reply, [AppRoles.LINKS_MANAGER]);
      },
    },
    async (request, reply) => {
      if (!request.userRoles) {
        throw new UnauthorizedError({ message: "Could not get user roles." });
      }
      try {
        // TODO: optimize this to use a proper query in sequelize
        const isAdmin = request.userRoles.has(AppRoles.LINKS_ADMIN);
        let filteredLinks = await ShortLinkModel.findAll();
        if (!isAdmin) {
          filteredLinks = filteredLinks.filter((slm: ShortLinkModel) => {
            return (
              slm.author == request.username ||
              (slm.groups &&
                request.userRoles &&
                intersection(new Set(slm.groups), request.userRoles).size > 0)
            );
          });
        }
        const myLinks: ShortLinkModel[] = [];
        const delegatedLinks: ShortLinkModel[] = [];
        for (const link of filteredLinks) {
          if (link.author === request.username) {
            myLinks.push(link);
          } else {
            delegatedLinks.push(link);
          }
        }
        return reply.send({ admin: isAdmin, myLinks, delegatedLinks });
      } catch (e) {
        if (e instanceof BaseError) {
          throw e;
        }
        request.log.error(`Could not get user's links: ${e}`);
        throw new InternalServerError({ message: "Could not get user links." });
      }
    },
  );
};

export default linkryRoutes;
