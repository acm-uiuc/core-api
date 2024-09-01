import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const postSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().url(),
  price: z.number().min(0),
});

type VendingItemPostRequest = z.infer<typeof postSchema>;

const vendingPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get("/items", async (request, reply) => {
    reply.send({
      items: [
        {
          rowid: 1,
          name: "TBD",
          image_url:
            "https://acm-brand-images.s3.amazonaws.com/square-blue.png",
          price: 400,
          calories: null,
          fat: null,
          carbs: null,
          fiber: null,
          sugar: null,
          protein: null,
          quantity: 100,
          locations: null,
        },
      ],
    });
  });
  fastify.post<{ Body: VendingItemPostRequest }>(
    "/items",
    {
      preValidation: async (request, reply) => {
        await fastify.zodValidateBody(request, reply, postSchema);
      },
    },
    async (request, reply) => {
      reply.send({ status: "Not implemented." });
    },
  );
};

export default vendingPlugin;
