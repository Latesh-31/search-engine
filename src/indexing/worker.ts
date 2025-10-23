import { IndexingMetrics } from './metrics';
import { IndexingQueue } from './queue';
import {
  IndexingJob,
  IndexingJobHandler,
  IndexingJobResult,
  IndexingLogger,
} from './types';

export interface IndexingWorkerOptions {
  batchSize?: number;
  pollIntervalMs?: number;
  logger?: IndexingLogger;
}

const isTransientJobResult = (result: IndexingJobResult): boolean => result === 'skipped';

export class IndexingWorker {
  private readonly batchSize: number;

  private readonly pollIntervalMs: number;

  private readonly logger?: IndexingLogger;

  private running = false;

  constructor(
    private readonly queue: IndexingQueue,
    private readonly handler: IndexingJobHandler,
    private readonly metrics: IndexingMetrics,
    options: IndexingWorkerOptions = {},
  ) {
    this.batchSize = options.batchSize ?? 10;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.logger = options.logger;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    void this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async processNextBatch(): Promise<number> {
    const jobs = await this.queue.reserveBatch(this.batchSize);
    if (jobs.length === 0) {
      return 0;
    }

    for (const job of jobs) {
      await this.dispatchJob(job);
    }

    return jobs.length;
  }

  async runOnce(): Promise<number> {
    return this.processNextBatch();
  }

  private async dispatchJob(job: IndexingJob): Promise<void> {
    this.metrics.recordProcessed(job.entityType);

    try {
      const result = await this.handler(job);
      await this.queue.complete(job.id);

      if (result === 'indexed' || result === 'deleted') {
        this.metrics.recordSuccess(job.entityType);
        this.logger?.debug?.({ job, result }, 'Indexing job completed');
      } else if (isTransientJobResult(result)) {
        this.metrics.recordSkipped(job.entityType);
        this.logger?.debug?.({ job, result }, 'Indexing job skipped');
      }
    } catch (error) {
      const resolution = await this.queue.fail(job, error as Error);
      if (resolution === 'retry') {
        this.metrics.recordRetry(job.entityType, (error as Error).message);
        this.logger?.warn?.({ job, error }, 'Indexing job failed; scheduled for retry');
        return;
      }

      this.metrics.recordDeadLetter(job.entityType, (error as Error).message);
      this.logger?.error?.({ job, error }, 'Indexing job failed; moved to dead-letter queue');
    }
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const processed = await this.processNextBatch();
      if (!this.running) {
        break;
      }

      if (processed === 0) {
        await this.delay(this.pollIntervalMs);
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
