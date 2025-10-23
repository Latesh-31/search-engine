export type IndexEntityType = 'review';

export enum IndexingOperation {
  UPSERT = 'UPSERT',
  DELETE = 'DELETE',
}

export interface IndexingEvent {
  id: string;
  entityType: IndexEntityType;
  entityId: string;
  operation: IndexingOperation;
  cursor?: Date;
  metadata?: Record<string, unknown>;
  availableAt?: Date;
  maxAttempts?: number;
}

export interface IndexingJob extends IndexingEvent {
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lastError?: string;
}

export interface DeadLetterItem extends IndexingEvent {
  attempts: number;
  failedAt: Date;
  error: string;
}

export type IndexingJobResult = 'indexed' | 'deleted' | 'skipped';

export type IndexingJobHandler = (job: IndexingJob) => Promise<IndexingJobResult>;

export type IndexingFailureResolution = 'retry' | 'dead-letter';

export type RetryBackoffStrategy = (attempt: number) => number;

export interface IndexingLogger {
  debug?(payload: unknown, message?: string): void;
  info?(payload: unknown, message?: string): void;
  warn?(payload: unknown, message?: string): void;
  error?(payload: unknown, message?: string): void;
}
