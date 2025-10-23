import fastify, { type FastifyInstance } from 'fastify';

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
