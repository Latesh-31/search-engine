import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { sendValidationError } from './helpers';
import type { SearchService } from '../services/search';

const categoryTierLevelEnum = z.enum(['lower', 'medium', 'higher']);
const adBoostStatusEnum = z.enum(['boosted', 'organic']);
const sortEnum = z.enum(['relevance', 'newest']);

const searchReviewsRequestSchema = z
  .object({
    query: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    sort: sortEnum.default('relevance'),
    filters: z
      .object({
        categoryTierLevels: z.array(categoryTierLevelEnum).min(1).max(3).optional(),
        adBoostStatuses: z.array(adBoostStatusEnum).min(1).max(2).optional(),
      })
      .optional(),
  })
  .strict();

interface SearchRoutesOptions {
  searchService: SearchService;
}

const searchRoutes: FastifyPluginAsync<SearchRoutesOptions> = async (fastify, options) => {
  const { searchService } = options;

  fastify.post('/reviews', async (request, reply) => {
    const parsed = searchReviewsRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid search payload.', parsed.error.format());
    }

    const result = await searchService.searchReviews(parsed.data);
    return reply.send({ data: result });
  });
};

export default searchRoutes;
