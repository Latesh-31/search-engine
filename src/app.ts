import fastify, { type FastifyInstance } from 'fastify';

import env from './config/env';
import healthRoutes from './routes/health';
import { closeOpenSearchClient } from './services/opensearch';
import { closePostgresPool } from './services/postgres';

export const buildApp = (): FastifyInstance => {
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  app.get('/', async () => ({
    status: 'ok',
    service: 'search-platform-api',
  }));

  app.register(healthRoutes, { prefix: '/health' });

  app.addHook('onClose', async () => {
    await Promise.allSettled([closePostgresPool(), closeOpenSearchClient()]);
  });

  return app;
};
