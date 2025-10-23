import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { handleServiceError, sendNotFound, sendValidationError } from './helpers';
import { AppServices } from '../services/domain';

interface CategoryTierRoutesOptions {
  services: AppServices;
}

const categoryTierIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createCategoryTierSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(slugPattern, { message: 'Slug must contain lowercase letters, numbers, and dashes only.' }),
  description: z.string().max(500).optional(),
  priority: z.coerce.number().int().min(0).optional(),
});

const updateCategoryTierSchema = createCategoryTierSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update a category tier.',
  });

const categoryTierRoutes: FastifyPluginAsync<CategoryTierRoutesOptions> = async (fastify, options) => {
  const { categoryTierService } = options.services;

  fastify.get('/', async (_, reply) => {
    const tiers = await categoryTierService.listCategoryTiers();
    return reply.send({ data: tiers });
  });

  fastify.post('/', async (request, reply) => {
    const parsed = createCategoryTierSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid category tier payload.', parsed.error.format());
    }

    try {
      const tier = await categoryTierService.createCategoryTier(parsed.data);
      return reply.code(201).send({ data: tier });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.get('/:id', async (request, reply) => {
    const parsedParams = categoryTierIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid category tier identifier.', parsedParams.error.format());
    }

    const tier = await categoryTierService.getCategoryTier(parsedParams.data.id);

    if (!tier) {
      return sendNotFound(reply, 'Category tier');
    }

    return reply.send({ data: tier });
  });

  fastify.put('/:id', async (request, reply) => {
    const parsedParams = categoryTierIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid category tier identifier.', parsedParams.error.format());
    }

    const parsedBody = updateCategoryTierSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, 'Invalid category tier payload.', parsedBody.error.format());
    }

    try {
      const tier = await categoryTierService.updateCategoryTier(parsedParams.data.id, parsedBody.data);

      if (!tier) {
        return sendNotFound(reply, 'Category tier');
      }

      return reply.send({ data: tier });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const parsedParams = categoryTierIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid category tier identifier.', parsedParams.error.format());
    }

    const deleted = await categoryTierService.deleteCategoryTier(parsedParams.data.id);

    if (!deleted) {
      return sendNotFound(reply, 'Category tier');
    }

    return reply.status(204).send();
  });
};

export default categoryTierRoutes;
