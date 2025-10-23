import env from './config/env';
import { buildApp } from './app';
import { getPrismaClient } from './services/prisma';
import { getOpenSearchClient } from './services/opensearch';
import { getPostgresPool } from './services/postgres';
import {
  createReviewIndexingPipeline,
  type ReviewIndexingPipelineControls,
} from './indexing';

const REVIEW_INDEX_NAME = 'reviews';

const start = async () => {
  const app = buildApp();

  let pipeline: ReviewIndexingPipelineControls | undefined;

  if (env.NODE_ENV !== 'test') {
    const prisma = getPrismaClient();
    const openSearch = getOpenSearchClient();
    const postgresPool = getPostgresPool();

    try {
      pipeline = createReviewIndexingPipeline(prisma, openSearch, postgresPool, {
        indexName: REVIEW_INDEX_NAME,
        refresh: 'wait_for',
        workerOptions: {
          batchSize: 25,
          pollIntervalMs: 2000,
        },
        logger: app.log,
      });

      await pipeline.start();
      app.log.info('Review indexing pipeline started');
    } catch (error) {
      app.log.error(error, 'Failed to start review indexing pipeline');
      process.exit(1);
    }
  }

  let shuttingDown = false;
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    try {
      app.log.info({ signal }, 'Received shutdown signal');
      if (pipeline) {
        await pipeline.stop();
      }
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error(error, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  signals.forEach((signal) => {
    process.on(signal, () => {
      void shutdown(signal);
    });
  });

  try {
    const bootstrapResults = await bootstrapOpenSearchInfrastructure(app.log);
    if (bootstrapResults.length > 0) {
      app.log.info({ opensearch: bootstrapResults }, 'OpenSearch infrastructure ensured');
    }

    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info({ port: env.PORT }, 'Server is listening');
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    if (pipeline) {
      try {
        await pipeline.stop();
      } catch (stopError) {
        app.log.error(stopError, 'Failed to stop indexing pipeline after server start failure');
      }
    }
    process.exit(1);
  }
};

void start();
