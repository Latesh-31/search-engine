import { PrismaClient, Prisma } from '@prisma/client';

import {
  DeadLetterItem,
  IndexingFailureResolution,
  IndexingJob,
  IndexingOperation,
  RetryBackoffStrategy,
} from './types';
import { EnqueueIndexingEvent, IndexingQueue, exponentialBackoff } from './queue';

const truncate = (value: string, limit = 1000): string => {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}…`;
};

export interface PrismaIndexingQueueOptions {
  defaultMaxAttempts?: number;
  backoffStrategy?: RetryBackoffStrategy;
}

export class PrismaIndexingQueue implements IndexingQueue {
  private readonly prisma: PrismaClient;

  private readonly defaultMaxAttempts: number;

  private readonly backoffStrategy: RetryBackoffStrategy;

  constructor(prisma: PrismaClient, options: PrismaIndexingQueueOptions = {}) {
    this.prisma = prisma;
    this.defaultMaxAttempts = options.defaultMaxAttempts ?? 5;
    this.backoffStrategy = options.backoffStrategy ?? exponentialBackoff;
  }

  async enqueue(event: EnqueueIndexingEvent): Promise<void> {
    await this.prisma.searchIndexingJob.upsert({
      where: { id: event.id },
      update: {
        entityType: event.entityType,
        entityId: event.entityId,
        operation: event.operation,
        cursor: event.cursor,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
        availableAt: event.availableAt ?? new Date(),
        maxAttempts: event.maxAttempts ?? this.defaultMaxAttempts,
        attempts: 0,
        lastError: null,
      },
      create: {
        id: event.id,
        entityType: event.entityType,
        entityId: event.entityId,
        operation: event.operation,
        cursor: event.cursor,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
        availableAt: event.availableAt ?? new Date(),
        maxAttempts: event.maxAttempts ?? this.defaultMaxAttempts,
      },
    });
  }

  async reserveBatch(limit: number): Promise<IndexingJob[]> {
    if (limit <= 0) {
      return [];
    }

    const ready = await this.prisma.searchIndexingJob.findMany({
      where: {
        availableAt: {
          lte: new Date(),
        },
      },
      orderBy: [
        { cursor: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
    });

    const updated: IndexingJob[] = [];

    for (const job of ready) {
      const nextAttempts = job.attempts + 1;
      await this.prisma.searchIndexingJob.update({
        where: { id: job.id },
        data: {
          attempts: nextAttempts,
        },
      });

      updated.push({
        id: job.id,
        entityType: job.entityType as IndexingJob['entityType'],
        entityId: job.entityId,
        operation: job.operation as IndexingOperation,
        cursor: job.cursor ?? undefined,
        metadata: (job.metadata as Record<string, unknown> | null) ?? undefined,
        attempts: nextAttempts,
        maxAttempts: job.maxAttempts,
        availableAt: job.availableAt,
        lastError: job.lastError ?? undefined,
      });
    }

    return updated;
  }

  async complete(jobId: string): Promise<void> {
    try {
      await this.prisma.searchIndexingJob.delete({ where: { id: jobId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }
      throw error;
    }
  }

  async fail(job: IndexingJob, error: Error): Promise<IndexingFailureResolution> {
    const stored = await this.prisma.searchIndexingJob.findUnique({ where: { id: job.id } });
    if (!stored) {
      return 'dead-letter';
    }

    if (job.attempts >= job.maxAttempts) {
      await this.prisma.$transaction([
        this.prisma.searchIndexingDeadLetter.create({
          data: {
            jobId: job.id,
            entityType: job.entityType,
            entityId: job.entityId,
            operation: job.operation,
            cursor: job.cursor,
            attempts: job.attempts,
            error: truncate(error.message),
            metadata: job.metadata as Prisma.InputJsonValue | undefined,
          },
        }),
        this.prisma.searchIndexingJob.delete({ where: { id: job.id } }),
      ]);
      return 'dead-letter';
    }

    const delay = this.backoffStrategy(job.attempts);
    await this.prisma.searchIndexingJob.update({
      where: { id: job.id },
      data: {
        availableAt: new Date(Date.now() + delay),
        lastError: truncate(error.message),
      },
    });

    return 'retry';
  }

  async deadLetters(): Promise<DeadLetterItem[]> {
    const rows = await this.prisma.searchIndexingDeadLetter.findMany({
      orderBy: { failedAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      entityType: row.entityType as DeadLetterItem['entityType'],
      entityId: row.entityId,
      operation: row.operation as IndexingOperation,
      cursor: row.cursor ?? undefined,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
      attempts: row.attempts,
      error: row.error,
      failedAt: row.failedAt,
    }));
  }
}
