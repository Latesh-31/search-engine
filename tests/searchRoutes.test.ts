import { buildApp } from '../src/app';
import type { SearchReviewsResult, SearchService } from '../src/services/search';
import type { ReviewSearchDocument } from '../src/types/search';

describe('POST /search/reviews', () => {
  const createSearchResult = (): SearchReviewsResult => {
    const document: ReviewSearchDocument = {
      id: 'review-123',
      userId: 'user-456',
      categoryTierId: null,
      categoryTierLevel: null,
      title: 'Sample review',
      content: 'Detailed analysis of the sample product.',
      rating: 4,
      status: 'PUBLISHED',
      createdAt: new Date('2024-02-01T00:00:00Z').toISOString(),
      updatedAt: new Date('2024-02-02T00:00:00Z').toISOString(),
      author: {
        id: 'user-456',
        displayName: 'Sam Searcher',
        email: 'sam@example.com',
      },
      category: null,
      activityTotalQuantity: 5,
      boostCreditsPurchased: 0,
      boostCreditsConsumed: 0,
      boostCreditsRemaining: 0,
      adBoostStatus: 'organic',
    };

    return {
      page: 1,
      pageSize: 10,
      total: 1,
      took: 2,
      results: [
        {
          id: document.id,
          score: 1.5,
          review: document,
        },
      ],
      aggregations: {
        categoryTierLevels: [],
        adBoostStatus: [{ key: 'organic', docCount: 1 }],
      },
    };
  };

  it('returns search results when payload is valid', async () => {
    const result = createSearchResult();
    const searchReviewsMock = jest.fn().mockResolvedValue(result);
    const searchService: SearchService = {
      searchReviews: searchReviewsMock as unknown as SearchService['searchReviews'],
    };

    const app = buildApp({ searchService });

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/search/reviews',
        payload: {
          query: 'sample',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(searchReviewsMock).toHaveBeenCalledWith({
        query: 'sample',
        page: 1,
        pageSize: 10,
        sort: 'relevance',
        filters: undefined,
      });

      expect(response.json()).toEqual({ data: result });
    } finally {
      await app.close();
    }
  });

  it('returns validation errors for invalid payloads', async () => {
    const searchReviewsMock = jest.fn().mockResolvedValue(createSearchResult());
    const searchService: SearchService = {
      searchReviews: searchReviewsMock as unknown as SearchService['searchReviews'],
    };

    const app = buildApp({ searchService });

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/search/reviews',
        payload: {
          page: 0,
          filters: {
            categoryTierLevels: [],
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(searchReviewsMock).not.toHaveBeenCalled();

      const payload = response.json();
      expect(payload).toHaveProperty('message', 'Invalid search payload.');
    } finally {
      await app.close();
    }
  });
});
