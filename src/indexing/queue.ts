import {
  DeadLetterItem,
  IndexingEvent,
  IndexingFailureResolution,
  IndexingJob,
  RetryBackoffStrategy,
} from './types';

export type EnqueueIndexingEvent = IndexingEvent;

export interface IndexingQueue {
  enqueue(event: EnqueueIndexingEvent): Promise<void>;
  reserveBatch(limit: number): Promise<IndexingJob[]>;
  complete(jobId: string): Promise<void>;
  fail(job: IndexingJob, error: Error): Promise<IndexingFailureResolution>;
  deadLetters?(): Promise<DeadLetterItem[]>;
}

export const exponentialBackoff: RetryBackoffStrategy = (attempt) => {
  if (attempt <= 0) {
    return 0;
  }

  const baseDelayMs = 1000;
  return baseDelayMs * 2 ** (attempt - 1);
};
