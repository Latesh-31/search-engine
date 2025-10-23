import { FastifyReply, FastifyRequest } from 'fastify';

export const requestLogger = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const startTime = Date.now();

  reply.addHook('onSend', async () => {
    const duration = Date.now() - startTime;

    request.log.info(
      {
        req: {
          id: request.id,
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        res: {
          statusCode: reply.statusCode,
        },
        duration,
      },
      'Request completed',
    );
  });
};
