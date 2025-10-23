import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { handleServiceError, sendNotFound, sendValidationError } from './helpers';
import { AppServices } from '../services/domain';

interface UserRoutesOptions {
  services: AppServices;
}

const userIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
});

const updateUserSchema = createUserSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update a user.',
});

const userRoutes: FastifyPluginAsync<UserRoutesOptions> = async (fastify, options) => {
  const { userService } = options.services;

  fastify.get('/', async (_, reply) => {
    const users = await userService.listUsers();
    return reply.send({ data: users });
  });

  fastify.post('/', async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid user payload.', parsed.error.format());
    }

    try {
      const user = await userService.createUser(parsed.data);
      return reply.code(201).send({ data: user });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.get('/:id', async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid user identifier.', parsedParams.error.format());
    }

    const user = await userService.getUser(parsedParams.data.id);

    if (!user) {
      return sendNotFound(reply, 'User');
    }

    return reply.send({ data: user });
  });

  fastify.put('/:id', async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid user identifier.', parsedParams.error.format());
    }

    const parsedBody = updateUserSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return sendValidationError(reply, 'Invalid user payload.', parsedBody.error.format());
    }

    try {
      const user = await userService.updateUser(parsedParams.data.id, parsedBody.data);

      if (!user) {
        return sendNotFound(reply, 'User');
      }

      return reply.send({ data: user });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return sendValidationError(reply, 'Invalid user identifier.', parsedParams.error.format());
    }

    const deleted = await userService.deleteUser(parsedParams.data.id);

    if (!deleted) {
      return sendNotFound(reply, 'User');
    }

    return reply.status(204).send();
  });
};

export default userRoutes;
