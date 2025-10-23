import { Client } from '@opensearch-project/opensearch';

import { buildReviewDocument } from './reviewDocumentBuilder';
import { ReviewIndexingRepository } from './reviewIndexingRepository';
import { IndexingLogger } from './types';

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

const extractBulkItemError = (item: Record<string, unknown>): string | undefined => {
  if (!item) {
    return undefined;
  }

  const operation = (item.index ?? item.create ?? item.update ?? item.delete) as Record<string, unknown> | undefined;
  if (operation && typeof operation === 'object' && 'error' in operation) {
    const error = operation.error;
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'reason' in error && typeof (error as Record<string, unknown>).reason === 'string') {
      return (error as Record<string, unknown>).reason as string;
    }
    return JSON.stringify(error);
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

    const responseBody = (bulkResponse as unknown as { body?: Record<string, unknown> }).body ?? (bulkResponse as Record<string, unknown>);
    const items = Array.isArray(responseBody?.items)
      ? (responseBody.items as Record<string, unknown>[])
      : [];

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
