import fastify, { type FastifyInstance } from 'fastify';
import fastifySensible from '@fastify/sensible';

import env from './config/env';
import { createRepositories } from './repositories';
import boostRoutes from './routes/boosts';
import categoryTierRoutes from './routes/categoryTiers';
import healthRoutes from './routes/health';
import reviewActivityRoutes from './routes/reviewActivities';
import reviewRoutes from './routes/reviews';
import searchRoutes from './routes/search';
import userRoutes from './routes/users';
import { createServices } from './services/domain';
import { closeOpenSearchClient, getOpenSearchClient } from './services/opensearch';
import { createSearchService, type SearchService } from './services/search';
import { closePostgresPool } from './services/postgres';
import { closePrismaClient, getPrismaClient } from './services/prisma';
import { errorHandler } from './middleware/errorHandler';
import { observabilityPlugin } from './plugins/observability';
import { validationPlugin } from './plugins/validation';

export interface BuildAppOptions {
  searchService?: SearchService;
}

export const buildApp = (options: BuildAppOptions = {}): FastifyInstance => {
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  const prisma = getPrismaClient();
  const repositories = createRepositories(prisma);
  const services = createServices(repositories);
  const searchService = options.searchService ?? createSearchService(getOpenSearchClient());

  void app.register(fastifySensible);
  void app.register(observabilityPlugin);
  void app.register(validationPlugin);

  app.setErrorHandler(errorHandler);

  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ url: request.url, method: request.method }, 'Route not found');
    return reply.status(404).send({
      statusCode: 404,
      error: 'NotFoundError',
      message: `Route ${request.method} ${request.url} not found.`,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.id,
    });
  });

  app.get('/', async () => ({
    status: 'ok',
    service: 'search-platform-api',
  }));

  app.register(healthRoutes, { prefix: '/health' });
  app.register(userRoutes, { prefix: '/users', services });
  app.register(reviewRoutes, { prefix: '/reviews', services });
  app.register(searchRoutes, { prefix: '/search', searchService });
  app.register(reviewActivityRoutes, { prefix: '/review-activities', services });
  app.register(boostRoutes, { prefix: '/boosts', services });
  app.register(categoryTierRoutes, { prefix: '/category-tiers', services });

  app.addHook('onClose', async () => {
    await Promise.allSettled([closePostgresPool(), closeOpenSearchClient(), closePrismaClient()]);
  });

  return app;
};
