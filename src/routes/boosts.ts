import { BoostType } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { handleServiceError, sendNotFound, sendValidationError } from './helpers';
import { AppServices, BoostUsageInsufficientCreditsError } from '../services/domain';

interface BoostRoutesOptions {
  services: AppServices;
}

const boostIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const createBoostSchema = z.object({
  userId: z.string().uuid(),
  reviewId: z.string().uuid().optional(),
  categoryTierId: z.string().uuid().optional(),
  boostType: z.nativeEnum(BoostType),
  creditsPurchased: z.coerce.number().int().positive(),
  creditsConsumed: z.coerce.number().int().min(0).optional(),
  activatedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
});

const updateBoostSchema = createBoostSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update a boost purchase.',
  });

const createBoostUsageSchema = z.object({
  reviewId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().positive().optional(),
  appliedAt: z.coerce.date().optional(),
});

const boostRoutes: FastifyPluginAsync<BoostRoutesOptions> = async (fastify, options) => {
  const { boostService } = options.services;

  fastify.get('/', async (_, reply) => {
    const boosts = await boostService.listBoostPurchases();
    return reply.send({ data: boosts });
  });

  fastify.post('/', async (request, reply) => {
    const parsed = createBoostSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid boost purchase payload.', parsed.error.format());
    }

    try {
      const boost = await boostService.createBoostPurchase(parsed.data);
      return reply.code(201).send({ data: boost });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.get('/:id', async (request, reply) => {
    const parsedParams = boostIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid boost identifier.', parsedParams.error.format());
    }

    const boost = await boostService.getBoostPurchase(parsedParams.data.id);

    if (!boost) {
      return sendNotFound(reply, 'Boost purchase');
    }

    return reply.send({ data: boost });
  });

  fastify.put('/:id', async (request, reply) => {
    const parsedParams = boostIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid boost identifier.', parsedParams.error.format());
    }

    const parsedBody = updateBoostSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, 'Invalid boost purchase payload.', parsedBody.error.format());
    }

    try {
      const boost = await boostService.updateBoostPurchase(parsedParams.data.id, parsedBody.data);

      if (!boost) {
        return sendNotFound(reply, 'Boost purchase');
      }

      return reply.send({ data: boost });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const parsedParams = boostIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid boost identifier.', parsedParams.error.format());
    }

    const deleted = await boostService.deleteBoostPurchase(parsedParams.data.id);

    if (!deleted) {
      return sendNotFound(reply, 'Boost purchase');
    }

    return reply.status(204).send();
  });

  fastify.get('/:id/usage', async (request, reply) => {
    const parsedParams = boostIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid boost identifier.', parsedParams.error.format());
    }

    const usages = await boostService.listBoostUsage(parsedParams.data.id);
    return reply.send({ data: usages });
  });

  fastify.post('/:id/usage', async (request, reply) => {
    const parsedParams = boostIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid boost identifier.', parsedParams.error.format());
    }

    const parsedBody = createBoostUsageSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, 'Invalid boost usage payload.', parsedBody.error.format());
    }

    try {
      const result = await boostService.createBoostUsage({
        boostPurchaseId: parsedParams.data.id,
        ...parsedBody.data,
      });

      if (!result) {
        return sendNotFound(reply, 'Boost purchase');
      }

      return reply.code(201).send({ data: result });
    } catch (error) {
      if (error instanceof BoostUsageInsufficientCreditsError) {
        return reply.status(409).send({ message: error.message });
      }

      return handleServiceError(reply, error);
    }
  });
};

export default boostRoutes;
