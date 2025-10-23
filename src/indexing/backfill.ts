import { Client } from '@opensearch-project/opensearch';

import { IndexingLogger } from './types';
import { buildReviewDocument } from './reviewDocumentBuilder';
import { ReviewIndexingRepository } from './reviewIndexingRepository';

export interface ReviewBackfillOptions {
  indexName: string;
  chunkSize?: number;
  refresh?: boolean | 'wait_for';
  logger?: IndexingLogger;
}

export interface ReviewBackfillResult {
  total: number;
  indexed: number;
  failed: number;
  batches: number;
}

const extractBulkItemError = (item: Record<string, any>): string | undefined => {
  if (!item) {
    return undefined;
  }

  const operation = item.index ?? item.create ?? item.update ?? item.delete;
  if (operation && typeof operation === 'object' && operation.error) {
    if (typeof operation.error === 'string') {
      return operation.error;
    }
    if (operation.error && typeof operation.error.reason === 'string') {
      return operation.error.reason;
    }
    return JSON.stringify(operation.error);
  }

  return undefined;
};

export const runReviewBackfill = async (
  repository: ReviewIndexingRepository,
  client: Client,
  options: ReviewBackfillOptions,
): Promise<ReviewBackfillResult> => {
  const reviews = await repository.listAll();
  const chunkSize = options.chunkSize ?? 500;
  const indexName = options.indexName;

  if (reviews.length === 0) {
    return { total: 0, indexed: 0, failed: 0, batches: 0 };
  }

  let indexed = 0;
  let failed = 0;
  let batches = 0;

  for (let offset = 0; offset < reviews.length; offset += chunkSize) {
    const chunk = reviews.slice(offset, offset + chunkSize);
    const bodyPayload = chunk.flatMap((review) => {
      const document = buildReviewDocument(review);
      return [{ index: { _index: indexName, _id: document.id } }, document];
    });

    const bulkResponse = await client.bulk({
      refresh: options.refresh,
      body: bodyPayload,
    });

    const responseBody = (bulkResponse as unknown as { body?: Record<string, any> }).body ?? (bulkResponse as Record<string, any>);
    const items = Array.isArray(responseBody?.items) ? responseBody.items : [];

    if (items.length === 0) {
      indexed += chunk.length;
    } else {
      for (const item of items) {
        const error = extractBulkItemError(item);
        if (error) {
          failed += 1;
          options.logger?.error?.({ item, error }, 'Failed to index review during backfill');
        } else {
          indexed += 1;
        }
      }
    }

    if (responseBody?.errors) {
      options.logger?.warn?.(
        { chunkSize: chunk.length, failuresInChunk: failed },
        'Bulk backfill completed with individual document failures',
      );
    }

    batches += 1;
  }

  return {
    total: reviews.length,
    indexed,
    failed,
    batches,
  };
};
