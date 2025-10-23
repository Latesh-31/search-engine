import { Client } from '@opensearch-project/opensearch';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { PostgresChangeSubscriber, PostgresChangeSubscriberOptions } from './changeSubscriber';
import { IndexingMetrics } from './metrics';
import { PrismaIndexingQueue, PrismaIndexingQueueOptions } from './prismaQueue';
import { IndexingQueue } from './queue';
import { ReviewIndexingHandler } from './reviewIndexingHandler';
import { ReviewIndexingRepository } from './reviewIndexingRepository';
import { IndexingLogger } from './types';
import { IndexingWorker, IndexingWorkerOptions } from './worker';

export interface ReviewIndexingPipelineOptions {
  indexName: string;
  refresh?: boolean | 'wait_for';
  queue?: IndexingQueue;
  queueOptions?: PrismaIndexingQueueOptions;
  workerOptions?: Omit<IndexingWorkerOptions, 'logger'>;
  subscriberOptions?: PostgresChangeSubscriberOptions;
  logger?: IndexingLogger;
}

export interface ReviewIndexingPipelineControls {
  start(): Promise<void>;
  stop(): Promise<void>;
  metrics: IndexingMetrics;
  queue: IndexingQueue;
}

class ReviewIndexingPipeline implements ReviewIndexingPipelineControls {
  readonly metrics: IndexingMetrics;

  readonly queue: IndexingQueue;

  private readonly worker: IndexingWorker;

  private readonly subscriber: PostgresChangeSubscriber;

  private running = false;

  constructor(queue: IndexingQueue, subscriber: PostgresChangeSubscriber, metrics: IndexingMetrics, worker: IndexingWorker) {
    this.queue = queue;
    this.subscriber = subscriber;
    this.metrics = metrics;
    this.worker = worker;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    await this.subscriber.start();
    await this.worker.start();
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    await this.worker.stop();
    await this.subscriber.stop();
    this.running = false;
  }
}

export const createReviewIndexingPipeline = (
  prisma: PrismaClient,
  client: Client,
  pool: Pool,
  options: ReviewIndexingPipelineOptions,
): ReviewIndexingPipelineControls => {
  const repository = new ReviewIndexingRepository(prisma);
  const metrics = new IndexingMetrics();
  const queue =
    options.queue ?? new PrismaIndexingQueue(prisma, options.queueOptions);

  const handler = new ReviewIndexingHandler(repository, client, {
    indexName: options.indexName,
    refresh: options.refresh,
  }, options.logger);

  const worker = new IndexingWorker(queue, (job) => handler.handle(job), metrics, {
    ...options.workerOptions,
    logger: options.logger,
  });

  const subscriber = new PostgresChangeSubscriber(pool, queue, {
    ...options.subscriberOptions,
    logger: options.logger,
  });

  return new ReviewIndexingPipeline(queue, subscriber, metrics, worker);
};
