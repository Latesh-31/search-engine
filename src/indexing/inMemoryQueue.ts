import { DeadLetterItem, IndexingJob, RetryBackoffStrategy } from './types';
import { EnqueueIndexingEvent, IndexingQueue, exponentialBackoff } from './queue';

interface InternalJob extends IndexingJob {
  processing: boolean;
}

export interface InMemoryQueueOptions {
  defaultMaxAttempts?: number;
  backoffStrategy?: RetryBackoffStrategy;
}

export class InMemoryIndexingQueue implements IndexingQueue {
  private readonly jobs = new Map<string, InternalJob>();

  private readonly deadLetterItems: DeadLetterItem[] = [];

  private readonly defaultMaxAttempts: number;

  private readonly backoffStrategy: RetryBackoffStrategy;

  constructor(options: InMemoryQueueOptions = {}) {
    this.defaultMaxAttempts = options.defaultMaxAttempts ?? 5;
    this.backoffStrategy = options.backoffStrategy ?? exponentialBackoff;
  }

  async enqueue(event: EnqueueIndexingEvent): Promise<void> {
    const existing = this.jobs.get(event.id);

    const job: InternalJob = {
      id: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      operation: event.operation,
      cursor: event.cursor,
      metadata: event.metadata,
      attempts: existing?.attempts ?? 0,
      maxAttempts: event.maxAttempts ?? existing?.maxAttempts ?? this.defaultMaxAttempts,
      availableAt: event.availableAt ?? new Date(),
      lastError: existing?.lastError,
      processing: false,
    };

    if (existing && existing.cursor && event.cursor && event.cursor > existing.cursor) {
      job.attempts = 0;
      job.lastError = undefined;
    }

    this.jobs.set(job.id, job);
  }

  async reserveBatch(limit: number): Promise<IndexingJob[]> {
    if (limit <= 0) {
      return [];
    }

    const now = Date.now();
    const ready = Array.from(this.jobs.values())
      .filter((job) => !job.processing && job.availableAt.getTime() <= now)
      .sort((a, b) => {
        const aCursor = a.cursor?.getTime() ?? a.availableAt.getTime();
        const bCursor = b.cursor?.getTime() ?? b.availableAt.getTime();
        if (aCursor === bCursor) {
          return a.id.localeCompare(b.id);
        }
        return aCursor - bCursor;
      });

    const selected = ready.slice(0, limit);

    return selected.map((job) => {
      job.processing = true;
      job.attempts += 1;
      return {
        id: job.id,
        entityType: job.entityType,
        entityId: job.entityId,
        operation: job.operation,
        cursor: job.cursor,
        metadata: job.metadata,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        availableAt: job.availableAt,
        lastError: job.lastError,
      };
    });
  }

  async complete(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  async fail(job: IndexingJob, error: Error): Promise<'retry' | 'dead-letter'> {
    const existing = this.jobs.get(job.id);
    if (!existing) {
      return 'dead-letter';
    }

    existing.lastError = error.message;

    if (existing.attempts >= existing.maxAttempts) {
      this.jobs.delete(job.id);
      this.deadLetterItems.push({
        id: existing.id,
        entityType: existing.entityType,
        entityId: existing.entityId,
        operation: existing.operation,
        cursor: existing.cursor,
        metadata: existing.metadata,
        attempts: existing.attempts,
        error: error.message,
        failedAt: new Date(),
      });
      return 'dead-letter';
    }

    const delay = this.backoffStrategy(existing.attempts);
    existing.availableAt = new Date(Date.now() + delay);
    existing.processing = false;

    return 'retry';
  }

  async deadLetters(): Promise<DeadLetterItem[]> {
    return [...this.deadLetterItems];
  }
}
