import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ZodTypeAny } from 'zod';

const validationTargets = ['body', 'querystring', 'params', 'headers'] as const;

type ValidationTarget = (typeof validationTargets)[number];

export type ValidationSchemas = Partial<Record<ValidationTarget, ZodTypeAny>>;

declare module 'fastify' {
  interface FastifyRouteConfig {
    validation?: ValidationSchemas;
  }
}

const applyValidation = (request: FastifyRequest, target: ValidationTarget, schema?: ZodTypeAny) => {
  if (!schema) {
    return;
  }

  switch (target) {
    case 'body':
      request.body = schema.parse(request.body);
      break;
    case 'querystring':
      request.query = schema.parse(request.query);
      break;
    case 'params':
      request.params = schema.parse(request.params);
      break;
    case 'headers':
      request.headers = {
        ...request.headers,
        ...schema.parse(request.headers),
      };
      break;
    default:
      break;
  }
};

export const validationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', async (request) => {
    const schemas = request.routeConfig?.validation;

    if (!schemas) {
      return;
    }

    for (const target of validationTargets) {
      applyValidation(request, target, schemas[target]);
    }
  });
};
