import fastify, { type FastifyInstance } from 'fastify';

import env from './config/env';
import { createRepositories } from './repositories';
import boostRoutes from './routes/boosts';
import categoryTierRoutes from './routes/categoryTiers';
import healthRoutes from './routes/health';
import reviewActivityRoutes from './routes/reviewActivities';
import reviewRoutes from './routes/reviews';
import scoringRoutes from './routes/scoring';
import userRoutes from './routes/users';
import { createServices } from './services/domain';
import { closeOpenSearchClient } from './services/opensearch';
import { closePostgresPool } from './services/postgres';
import { closePrismaClient, getPrismaClient } from './services/prisma';

export const buildApp = (): FastifyInstance => {
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  const prisma = getPrismaClient();
  const repositories = createRepositories(prisma);
  const services = createServices(repositories);

  app.get('/', async () => ({
    status: 'ok',
    service: 'search-platform-api',
  }));

  void app.register(healthRoutes, { prefix: '/health' });
  void app.register(userRoutes, { prefix: '/users', services });
  void app.register(reviewRoutes, { prefix: '/reviews', services });
  void app.register(reviewActivityRoutes, { prefix: '/review-activities', services });
  void app.register(boostRoutes, { prefix: '/boosts', services });
  void app.register(categoryTierRoutes, { prefix: '/category-tiers', services });
  void app.register(scoringRoutes, { prefix: '/scoring', services });

  app.addHook('onClose', async () => {
    await Promise.allSettled([closePostgresPool(), closeOpenSearchClient(), closePrismaClient()]);
  });

  return app;
};
