import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

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

type UserIdParams = z.infer<typeof userIdParamsSchema>;
type CreateUserBody = z.infer<typeof createUserSchema>;
type UpdateUserBody = z.infer<typeof updateUserSchema>;

const userRoutes: FastifyPluginAsync<UserRoutesOptions> = async (fastify, options) => {
  const { userService } = options.services;

  fastify.get('/', async () => {
    const users = await userService.listUsers();
    return { data: users };
  });

  fastify.post<{ Body: CreateUserBody }>(
    '/',
    {
      config: {
        validation: {
          body: createUserSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await userService.createUser(request.body);
      return reply.code(201).send({ data: user });
    },
  );

  fastify.get<{ Params: UserIdParams }>(
    '/:id',
    {
      config: {
        validation: {
          params: userIdParamsSchema,
        },
      },
    },
    async (request) => {
      const user = await userService.getUser(request.params.id);

      if (!user) {
        throw fastify.httpErrors.notFound('User not found.');
      }

      return { data: user };
    },
  );

  fastify.put<{ Params: UserIdParams; Body: UpdateUserBody }>(
    '/:id',
    {
      config: {
        validation: {
          params: userIdParamsSchema,
          body: updateUserSchema,
        },
      },
    },
    async (request) => {
      const user = await userService.updateUser(request.params.id, request.body);

      if (!user) {
        throw fastify.httpErrors.notFound('User not found.');
      }

      return { data: user };
    },
  );

  fastify.delete<{ Params: UserIdParams }>(
    '/:id',
    {
      config: {
        validation: {
          params: userIdParamsSchema,
        },
      },
    },
    async (request, reply) => {
      const deleted = await userService.deleteUser(request.params.id);

      if (!deleted) {
        throw fastify.httpErrors.notFound('User not found.');
      }

      return reply.status(204).send();
    },
  );
};

export default userRoutes;
