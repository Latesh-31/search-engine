import { FastifyPluginAsync } from 'fastify';
import { ReviewStatus } from '@prisma/client';
import { z } from 'zod';

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

type ReviewIdParams = z.infer<typeof reviewIdParamsSchema>;
type CreateReviewBody = z.infer<typeof createReviewSchema>;
type UpdateReviewBody = z.infer<typeof updateReviewSchema>;

const reviewRoutes: FastifyPluginAsync<ReviewRoutesOptions> = async (fastify, options) => {
  const { reviewService } = options.services;

  fastify.get('/', async () => {
    const reviews = await reviewService.listReviews();
    return { data: reviews };
  });

  fastify.post<{ Body: CreateReviewBody }>(
    '/',
    {
      config: {
        validation: {
          body: createReviewSchema,
        },
      },
    },
    async (request, reply) => {
      const review = await reviewService.createReview(request.body);
      return reply.code(201).send({ data: review });
    },
  );

  fastify.get<{ Params: ReviewIdParams }>(
    '/:id',
    {
      config: {
        validation: {
          params: reviewIdParamsSchema,
        },
      },
    },
    async (request) => {
      const review = await reviewService.getReview(request.params.id);

      if (!review) {
        throw fastify.httpErrors.notFound('Review not found.');
      }

      return { data: review };
    },
  );

  fastify.put<{ Params: ReviewIdParams; Body: UpdateReviewBody }>(
    '/:id',
    {
      config: {
        validation: {
          params: reviewIdParamsSchema,
          body: updateReviewSchema,
        },
      },
    },
    async (request) => {
      const review = await reviewService.updateReview(request.params.id, request.body);

      if (!review) {
        throw fastify.httpErrors.notFound('Review not found.');
      }

      return { data: review };
    },
  );

  fastify.delete<{ Params: ReviewIdParams }>(
    '/:id',
    {
      config: {
        validation: {
          params: reviewIdParamsSchema,
        },
      },
    },
    async (request, reply) => {
      const deleted = await reviewService.deleteReview(request.params.id);

      if (!deleted) {
        throw fastify.httpErrors.notFound('Review not found.');
      }

      return reply.status(204).send();
    },
  );
};

export default reviewRoutes;
