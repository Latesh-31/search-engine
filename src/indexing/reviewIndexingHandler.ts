import { Client, errors } from '@opensearch-project/opensearch';

import {
  IndexingJob,
  IndexingJobResult,
  IndexingLogger,
  IndexingOperation,
} from './types';
import { ReviewIndexingRepository } from './reviewIndexingRepository';
import { buildReviewDocument } from './reviewDocumentBuilder';

export interface ReviewIndexingHandlerOptions {
  indexName: string;
  refresh?: boolean | 'wait_for';
  deleteOnMissing?: boolean;
}

export class ReviewIndexingHandler {
  private readonly indexName: string;

  private readonly refresh: ReviewIndexingHandlerOptions['refresh'];

  private readonly deleteOnMissing: boolean;

  constructor(
    private readonly repository: ReviewIndexingRepository,
    private readonly client: Client,
    options: ReviewIndexingHandlerOptions,
    private readonly logger?: IndexingLogger,
  ) {
    this.indexName = options.indexName;
    this.refresh = options.refresh;
    this.deleteOnMissing = options.deleteOnMissing ?? true;
  }

  async handle(job: IndexingJob): Promise<IndexingJobResult> {
    if (job.operation === IndexingOperation.DELETE) {
      return this.performDelete(job);
    }

    return this.performUpsert(job);
  }

  private async performUpsert(job: IndexingJob): Promise<IndexingJobResult> {
    const review = await this.repository.getById(job.entityId);

    if (!review) {
      if (!this.deleteOnMissing) {
        this.logger?.warn?.(
          { job },
          'Review missing during upsert; skipping because deleteOnMissing=false',
        );
        return 'skipped';
      }

      this.logger?.info?.({ job }, 'Review missing; issuing delete for stale document');
      return this.performDelete(job);
    }

    if (job.cursor && review.updatedAt > job.cursor) {
      this.logger?.debug?.(
        { job, reviewUpdatedAt: review.updatedAt.toISOString() },
        'Skipping stale review change event',
      );
      return 'skipped';
    }

    const document = buildReviewDocument(review);

    await this.client.index({
      index: this.indexName,
      id: review.id,
      body: document,
      refresh: this.refresh,
    });

    return 'indexed';
  }

  private async performDelete(job: IndexingJob): Promise<IndexingJobResult> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: job.entityId,
        refresh: this.refresh,
      });
      return 'deleted';
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        this.logger?.debug?.({ job }, 'Document already absent in index');
        return 'skipped';
      }
      throw error;
    }
  }
}
