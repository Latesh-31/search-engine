import { IndexEntityType } from './types';

export interface IndexingMetricsSnapshot {
  processed: number;
  succeeded: number;
  retried: number;
  deadLettered: number;
  skipped: number;
  failed: number;
  perEntity: Partial<Record<IndexEntityType, {
    processed: number;
    succeeded: number;
    retried: number;
    deadLettered: number;
    skipped: number;
  }>>;
  lastError?: string;
  lastUpdatedAt?: Date;
}

export class IndexingMetrics {
  private processed = 0;

  private succeeded = 0;

  private retried = 0;

  private deadLettered = 0;

  private skipped = 0;

  private failed = 0;

  private lastError?: string;

  private lastUpdatedAt?: Date;

  private readonly perEntity = new Map<IndexEntityType, {
    processed: number;
    succeeded: number;
    retried: number;
    deadLettered: number;
    skipped: number;
  }>();

  private readonly touch = (error?: string): void => {
    this.lastUpdatedAt = new Date();
    if (error) {
      this.lastError = error;
    }
  };

  private getEntityStats(entityType: IndexEntityType) {
    if (!this.perEntity.has(entityType)) {
      this.perEntity.set(entityType, {
        processed: 0,
        succeeded: 0,
        retried: 0,
        deadLettered: 0,
        skipped: 0,
      });
    }

    return this.perEntity.get(entityType)!;
  }

  recordProcessed(entityType: IndexEntityType): void {
    this.processed += 1;
    const stats = this.getEntityStats(entityType);
    stats.processed += 1;
    this.touch();
  }

  recordSuccess(entityType: IndexEntityType): void {
    this.succeeded += 1;
    const stats = this.getEntityStats(entityType);
    stats.succeeded += 1;
    this.touch();
  }

  recordRetry(entityType: IndexEntityType, error: string): void {
    this.retried += 1;
    this.failed += 1;
    const stats = this.getEntityStats(entityType);
    stats.retried += 1;
    this.touch(error);
  }

  recordDeadLetter(entityType: IndexEntityType, error: string): void {
    this.deadLettered += 1;
    this.failed += 1;
    const stats = this.getEntityStats(entityType);
    stats.deadLettered += 1;
    this.touch(error);
  }

  recordSkipped(entityType: IndexEntityType): void {
    this.skipped += 1;
    const stats = this.getEntityStats(entityType);
    stats.skipped += 1;
    this.touch();
  }

  snapshot(): IndexingMetricsSnapshot {
    const perEntity: IndexingMetricsSnapshot['perEntity'] = {};
    for (const [entity, stats] of this.perEntity.entries()) {
      perEntity[entity] = { ...stats };
    }

    return {
      processed: this.processed,
      succeeded: this.succeeded,
      retried: this.retried,
      deadLettered: this.deadLettered,
      skipped: this.skipped,
      failed: this.failed,
      perEntity,
      lastError: this.lastError,
      lastUpdatedAt: this.lastUpdatedAt,
    };
  }
}
