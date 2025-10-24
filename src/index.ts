import env from './config/env';
import { buildApp } from './app';
import { getPrismaClient } from './services/prisma';
import { bootstrapOpenSearchInfrastructure, getOpenSearchClient } from './services/opensearch';
import { getPostgresPool } from './services/postgres';
import {
  createReviewIndexingPipeline,
  type ReviewIndexingPipelineControls,
} from './indexing';
import { initializeTelemetry, shutdownTelemetry } from './telemetry';

const REVIEW_INDEX_NAME = 'reviews';

const start = async () => {
  await initializeTelemetry();

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
      await shutdownTelemetry();
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
      await shutdownTelemetry();
      app.log.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      app.log.error(error, 'Error during graceful shutdown');
      try {
        await shutdownTelemetry();
      } catch (telemetryError) {
        app.log.error(telemetryError, 'Failed to shut down telemetry after shutdown error');
      }
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
    await shutdownTelemetry();
    process.exit(1);
  }
};

void start();
