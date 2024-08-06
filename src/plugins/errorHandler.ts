import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { BaseError, InternalServerError, NotFoundError } from '../errors/index.js';

const errorHandlerPlugin = fp(async(fastify) => {
    fastify.setErrorHandler((err: unknown, request: FastifyRequest, reply: FastifyReply) => {
        let finalErr = new InternalServerError();
        if (err instanceof BaseError) {
            finalErr = err;
        }
        if (err instanceof BaseError) {
            request.log.error({errId: err.id, errName: err.name}, finalErr.toString())
        } else if (err instanceof Error) {
            request.log.error({errName: err.name}, 'Native unhandled error: response sent to client.')
        } else {
            request.log.error('Native unhandled error: response sent to client.')
        }
        reply.status(finalErr.httpStatusCode).type('application/json').send({
            error: true,
            name: finalErr.name,
            id: finalErr.id,
            message: finalErr.message,
        })
    })
    fastify.setNotFoundHandler((request: FastifyRequest) => {
        throw new NotFoundError({endpointName: request.url});
    })
})

export default errorHandlerPlugin;