import { ActivityType } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { handleServiceError, sendNotFound, sendValidationError } from './helpers';
import { AppServices } from '../services/domain';

interface ReviewActivityRoutesOptions {
  services: AppServices;
}

const activityIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const listActivitiesQuerySchema = z.object({
  reviewId: z.string().uuid(),
});

const createReviewActivitySchema = z.object({
  reviewId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  type: z.nativeEnum(ActivityType),
  quantity: z.coerce.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
  recordedAt: z.coerce.date().optional(),
});

const updateReviewActivitySchema = createReviewActivitySchema
  .omit({ reviewId: true })
  .partial()
  .extend({
    reviewId: z.never().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update an activity.',
  });

const reviewActivityRoutes: FastifyPluginAsync<ReviewActivityRoutesOptions> = async (
  fastify,
  options,
) => {
  const { activityService } = options.services;

  fastify.get('/', async (request, reply) => {
    const parsedQuery = listActivitiesQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return sendValidationError(reply, 'A valid reviewId query parameter is required.', parsedQuery.error.format());
    }

    const activities = await activityService.listActivitiesByReview(parsedQuery.data.reviewId);
    return reply.send({ data: activities });
  });

  fastify.post('/', async (request, reply) => {
    const parsed = createReviewActivitySchema.safeParse(request.body);

    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid activity payload.', parsed.error.format());
    }

    try {
      const activity = await activityService.createActivity(parsed.data);
      return reply.code(201).send({ data: activity });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.get('/:id', async (request, reply) => {
    const parsedParams = activityIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid activity identifier.', parsedParams.error.format());
    }

    const activity = await activityService.getActivity(parsedParams.data.id);

    if (!activity) {
      return sendNotFound(reply, 'Review activity');
    }

    return reply.send({ data: activity });
  });

  fastify.put('/:id', async (request, reply) => {
    const parsedParams = activityIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid activity identifier.', parsedParams.error.format());
    }

    const parsedBody = updateReviewActivitySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, 'Invalid activity payload.', parsedBody.error.format());
    }

    try {
      const activity = await activityService.updateActivity(parsedParams.data.id, parsedBody.data);

      if (!activity) {
        return sendNotFound(reply, 'Review activity');
      }

      return reply.send({ data: activity });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const parsedParams = activityIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid activity identifier.', parsedParams.error.format());
    }

    const deleted = await activityService.deleteActivity(parsedParams.data.id);

    if (!deleted) {
      return sendNotFound(reply, 'Review activity');
    }

    return reply.status(204).send();
  });
};

export default reviewActivityRoutes;
