import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { handleServiceError, sendNotFound, sendValidationError } from './helpers';
import { AppServices } from '../services/domain';

interface ScoringRoutesOptions {
  services: AppServices;
}

const userIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const scoringRoutes: FastifyPluginAsync<ScoringRoutesOptions> = async (fastify, options) => {
  const { scoringService } = options.services;

  fastify.get('/:id', async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid user identifier.', parsedParams.error.format());
    }

    const user = await scoringService.getUserScore(parsedParams.data.id);

    if (!user) {
      return sendNotFound(reply, 'User');
    }

    return reply.send({ data: user });
  });

  fastify.post('/:id/calculate', async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid user identifier.', parsedParams.error.format());
    }

    try {
      const scoreResult = await scoringService.calculateUserScore(parsedParams.data.id);

      if (!scoreResult) {
        return sendNotFound(reply, 'User');
      }

      return reply.send({ data: scoreResult });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.put('/:id', async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid user identifier.', parsedParams.error.format());
    }

    try {
      const user = await scoringService.updateUserScore(parsedParams.data.id);

      if (!user) {
        return sendNotFound(reply, 'User');
      }

      return reply.send({ data: user });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });
};

export default scoringRoutes;
