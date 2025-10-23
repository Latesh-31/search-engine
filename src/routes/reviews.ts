import { ReviewStatus } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { handleServiceError, sendNotFound, sendValidationError } from './helpers';
import { AppServices } from '../services/domain';

interface ReviewRoutesOptions {
  services: AppServices;
}

const reviewIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const reviewFieldsSchema = z.object({
  categoryTierId: z.string().uuid().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  status: z.nativeEnum(ReviewStatus).optional(),
});

const createReviewSchema = reviewFieldsSchema.extend({
  userId: z.string().uuid(),
});

const updateReviewSchema = reviewFieldsSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update a review.',
  });

const reviewRoutes: FastifyPluginAsync<ReviewRoutesOptions> = async (fastify, options) => {
  const { reviewService } = options.services;

  fastify.get('/', async (_, reply) => {
    const reviews = await reviewService.listReviews();
    return reply.send({ data: reviews });
  });

  fastify.post('/', async (request, reply) => {
    const parsed = createReviewSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid review payload.', parsed.error.format());
    }

    try {
      const review = await reviewService.createReview(parsed.data);
      return reply.code(201).send({ data: review });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.get('/:id', async (request, reply) => {
    const parsedParams = reviewIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid review identifier.', parsedParams.error.format());
    }

    const review = await reviewService.getReview(parsedParams.data.id);

    if (!review) {
      return sendNotFound(reply, 'Review');
    }

    return reply.send({ data: review });
  });

  fastify.put('/:id', async (request, reply) => {
    const parsedParams = reviewIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid review identifier.', parsedParams.error.format());
    }

    const parsedBody = updateReviewSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, 'Invalid review payload.', parsedBody.error.format());
    }

    try {
      const review = await reviewService.updateReview(parsedParams.data.id, parsedBody.data);

      if (!review) {
        return sendNotFound(reply, 'Review');
      }

      return reply.send({ data: review });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const parsedParams = reviewIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid review identifier.', parsedParams.error.format());
    }

    const deleted = await reviewService.deleteReview(parsedParams.data.id);

    if (!deleted) {
      return sendNotFound(reply, 'Review');
    }

    return reply.status(204).send();
  });
};

export default reviewRoutes;
