import type { Client } from '@opensearch-project/opensearch';

import { createSearchService } from '../src/services/search';
import type { ReviewSearchDocument } from '../src/types/search';

describe('SearchService', () => {
  const createClient = (searchImplementation: jest.Mock): Client =>
    ({ search: searchImplementation } as unknown as Client);

  const createSampleDocument = (): ReviewSearchDocument => ({
    id: 'review-1',
    userId: 'user-1',
    categoryTierId: 'tier-1',
    categoryTierLevel: 'higher',
    title: 'Wireless Headset',
    content: 'Immersive sound and noise cancellation.',
    rating: 5,
    status: 'PUBLISHED',
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-02T00:00:00Z').toISOString(),
    author: {
      id: 'user-1',
      displayName: 'Audio Expert',
      email: 'expert@example.com',
    },
    category: {
      id: 'tier-1',
      name: 'Premium Electronics',
      priority: 80,
    },
    activityTotalQuantity: 42,
    boostCreditsPurchased: 12,
    boostCreditsConsumed: 4,
    boostCreditsRemaining: 8,
    adBoostStatus: 'boosted',
  });

  it('builds function score queries with filters and composites boosts', async () => {
    const document = createSampleDocument();
    const searchMock = jest.fn().mockResolvedValue({
      body: {
        took: 7,
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: document.id,
              _score: 4.2,
              _source: document,
            },
          ],
        },
        aggregations: {
          categoryTierLevels: {
            buckets: [{ key: 'higher', doc_count: 1 }],
          },
          adBoostStatus: {
            buckets: [{ key: 'boosted', doc_count: 1 }],
          },
        },
      },
    });

    const service = createSearchService(createClient(searchMock));

    const result = await service.searchReviews({
      query: 'wireless headset',
      page: 2,
      pageSize: 5,
      sort: 'newest',
      filters: {
        categoryTierLevels: ['higher'],
        adBoostStatuses: ['boosted'],
      },
    });

    expect(searchMock).toHaveBeenCalledTimes(1);

    const callArguments = searchMock.mock.calls[0][0];

    expect(callArguments.index).toBe('reviews');
    expect(callArguments.body.from).toBe(5);
    expect(callArguments.body.size).toBe(5);
    expect(callArguments.body.sort).toEqual([{ createdAt: { order: 'desc' } }]);

    const functionScore = callArguments.body.query.function_score;

    expect(functionScore.query.bool.filter).toEqual(
      expect.arrayContaining([
        { term: { status: 'PUBLISHED' } },
        { terms: { categoryTierLevel: ['higher'] } },
        { terms: { adBoostStatus: ['boosted'] } },
      ]),
    );

    expect(functionScore.functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filter: { term: { adBoostStatus: 'boosted' } }, weight: 5 }),
        expect.objectContaining({ field_value_factor: expect.objectContaining({ field: 'activityTotalQuantity' }) }),
        expect.objectContaining({ field_value_factor: expect.objectContaining({ field: 'boostCreditsRemaining' }) }),
      ]),
    );

    expect(callArguments.body.aggs).toHaveProperty('categoryTierLevels');
    expect(callArguments.body.aggs).toHaveProperty('adBoostStatus');

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);
    expect(result.total).toBe(1);
    expect(result.took).toBe(7);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe(document.id);
    expect(result.results[0].score).toBe(4.2);
    expect(result.results[0].review).toEqual(document);
    expect(result.aggregations.categoryTierLevels).toEqual([{ key: 'higher', docCount: 1 }]);
    expect(result.aggregations.adBoostStatus).toEqual([{ key: 'boosted', docCount: 1 }]);
  });

  it('defaults to relevance ordering and match_all when no query string is provided', async () => {
    const searchMock = jest.fn().mockResolvedValue({
      body: {
        took: 3,
        hits: {
          total: 0,
          hits: [],
        },
        aggregations: {},
      },
    });

    const service = createSearchService(createClient(searchMock));

    await service.searchReviews({});

    expect(searchMock).toHaveBeenCalledTimes(1);

    const callArguments = searchMock.mock.calls[0][0];

    expect(callArguments.body.from).toBe(0);
    expect(callArguments.body.size).toBe(10);
    expect(callArguments.body.sort).toEqual([
      { _score: { order: 'desc' } },
      { createdAt: { order: 'desc' } },
    ]);
    expect(callArguments.body.query.function_score.query).toHaveProperty('match_all');
  });
});
