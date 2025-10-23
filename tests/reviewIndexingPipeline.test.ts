import { Client } from '@opensearch-project/opensearch';
import {
  InMemoryIndexingQueue,
  IndexingMetrics,
  IndexingOperation,
  IndexingWorker,
  ReviewIndexingHandler,
  ReviewIndexingRepository,
  ReviewForIndexing,
  runReviewBackfill,
} from '../src/indexing';
import { ReviewStatus } from '@prisma/client';

const createReview = (overrides: Partial<ReviewForIndexing> = {}): ReviewForIndexing => {
  const now = new Date('2024-01-01T00:00:00.000Z');

  const base: ReviewForIndexing = {
    id: 'review-1',
    userId: 'user-1',
    categoryTierId: null,
    title: 'Great product',
    content: 'Loved it',
    rating: 5,
    status: ReviewStatus.PUBLISHED,
    createdAt: now,
    updatedAt: now,
    user: {
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'User One',
      createdAt: now,
      updatedAt: now,
    },
    categoryTier: null,
    activityCounts: [],
    boostPurchases: [],
  };

  return {
    ...base,
    ...overrides,
    user: overrides.user ?? { ...base.user },
    categoryTier: overrides.categoryTier ?? base.categoryTier,
    activityCounts: overrides.activityCounts ?? [...base.activityCounts],
    boostPurchases: overrides.boostPurchases ?? [...base.boostPurchases],
  };
};

describe('ReviewIndexingHandler', () => {
  it('skips stale change events to maintain idempotency', async () => {
    const review = createReview({
      id: 'review-123',
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    });

    const repository: Pick<ReviewIndexingRepository, 'getById'> = {
      getById: jest.fn().mockResolvedValue(review),
    };

    const client = {
      index: jest.fn(),
      delete: jest.fn(),
    } as unknown as Client;

    const handler = new ReviewIndexingHandler(repository as ReviewIndexingRepository, client, {
      indexName: 'reviews',
    });

    const result = await handler.handle({
      id: 'event-1',
      entityType: 'review',
      entityId: 'review-123',
      operation: IndexingOperation.UPSERT,
      cursor: new Date('2024-01-01T00:00:00.000Z'),
      attempts: 1,
      maxAttempts: 3,
      availableAt: new Date(),
    });

    expect(result).toBe('skipped');
    expect(client.index).not.toHaveBeenCalled();
  });

  it('deletes documents when review data is missing', async () => {
    const repository: Pick<ReviewIndexingRepository, 'getById'> = {
      getById: jest.fn().mockResolvedValue(null),
    };

    const client = {
      index: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    } as unknown as Client;

    const handler = new ReviewIndexingHandler(repository as ReviewIndexingRepository, client, {
      indexName: 'reviews',
    });

    const result = await handler.handle({
      id: 'event-2',
      entityType: 'review',
      entityId: 'review-999',
      operation: IndexingOperation.UPSERT,
      attempts: 1,
      maxAttempts: 2,
      availableAt: new Date(),
    });

    expect(result).toBe('deleted');
    expect(client.delete).toHaveBeenCalledWith({
      index: 'reviews',
      id: 'review-999',
      refresh: undefined,
    });
  });
});

describe('IndexingWorker', () => {
  it('retries transient failures and eventually succeeds', async () => {
    const queue = new InMemoryIndexingQueue({ backoffStrategy: () => 0 });
    await queue.enqueue({
      id: 'job-1',
      entityType: 'review',
      entityId: 'review-1',
      operation: IndexingOperation.UPSERT,
    });

    const metrics = new IndexingMetrics();

    const handler = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce('indexed');

    const worker = new IndexingWorker(queue, handler, metrics, {
      batchSize: 1,
      pollIntervalMs: 0,
    });

    await worker.processNextBatch();
    await worker.processNextBatch();

    const snapshot = metrics.snapshot();
    expect(snapshot.retried).toBe(1);
    expect(snapshot.succeeded).toBe(1);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('moves exhausted jobs to the dead-letter queue', async () => {
    const queue = new InMemoryIndexingQueue({ backoffStrategy: () => 0 });
    await queue.enqueue({
      id: 'job-2',
      entityType: 'review',
      entityId: 'review-2',
      operation: IndexingOperation.UPSERT,
      maxAttempts: 2,
    });

    const metrics = new IndexingMetrics();
    const handler = jest.fn().mockRejectedValue(new Error('permanent failure'));

    const worker = new IndexingWorker(queue, handler, metrics, {
      batchSize: 1,
      pollIntervalMs: 0,
    });

    await worker.processNextBatch();
    await worker.processNextBatch();

    const snapshot = metrics.snapshot();
    expect(snapshot.retried).toBe(1);
    expect(snapshot.deadLettered).toBe(1);

    const deadLetters = await queue.deadLetters?.();
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters?.[0].id).toBe('job-2');
  });
});

describe('runReviewBackfill', () => {
  it('indexes reviews in bulk and reports successes', async () => {
    const reviews = [
      createReview({ id: 'review-a' }),
      createReview({ id: 'review-b' }),
    ];

    const repository: Pick<ReviewIndexingRepository, 'listAll'> = {
      listAll: jest.fn().mockResolvedValue(reviews),
    };

    const bulk = jest.fn().mockResolvedValue({
      body: {
        items: [
          { index: { status: 201 } },
          { index: { status: 201 } },
        ],
        errors: false,
      },
    });

    const client = { bulk } as unknown as Client;

    const result = await runReviewBackfill(repository as ReviewIndexingRepository, client, {
      indexName: 'reviews',
      chunkSize: 100,
    });

    expect(bulk).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ total: 2, indexed: 2, failed: 0, batches: 1 });
  });

  it('records failures when OpenSearch rejects documents', async () => {
    const reviews = [createReview({ id: 'review-c' }), createReview({ id: 'review-d' })];

    const repository: Pick<ReviewIndexingRepository, 'listAll'> = {
      listAll: jest.fn().mockResolvedValue(reviews),
    };

    const bulk = jest.fn().mockResolvedValue({
      body: {
        items: [
          { index: { status: 201 } },
          { index: { status: 400, error: { reason: 'validation error' } } },
        ],
        errors: true,
      },
    });

    const logger = { error: jest.fn(), warn: jest.fn() };

    const client = { bulk } as unknown as Client;

    const result = await runReviewBackfill(repository as ReviewIndexingRepository, client, {
      indexName: 'reviews',
      chunkSize: 10,
      logger,
    });

    expect(result.total).toBe(2);
    expect(result.indexed).toBe(1);
    expect(result.failed).toBe(1);
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
