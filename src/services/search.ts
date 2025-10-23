import type { Client } from '@opensearch-project/opensearch';

import { REVIEW_INDEX_ALIAS } from '../opensearch/indices';
import type { AdBoostStatus, CategoryTierLevel, ReviewSearchDocument } from '../types/search';

export type SearchSort = 'relevance' | 'newest';

export interface SearchReviewsFilters {
  categoryTierLevels?: CategoryTierLevel[];
  adBoostStatuses?: AdBoostStatus[];
}

export interface SearchReviewsParams {
  query?: string;
  page?: number;
  pageSize?: number;
  filters?: SearchReviewsFilters;
  sort?: SearchSort;
}

export interface SearchAggregationBucket {
  key: string;
  docCount: number;
}

export interface SearchReviewsResult {
  page: number;
  pageSize: number;
  total: number;
  took: number;
  results: Array<{
    id: string;
    score: number;
    review: ReviewSearchDocument;
  }>;
  aggregations: {
    categoryTierLevels: SearchAggregationBucket[];
    adBoostStatus: SearchAggregationBucket[];
  };
}

export interface SearchService {
  searchReviews(params: SearchReviewsParams): Promise<SearchReviewsResult>;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const buildFilterClauses = (filters: SearchReviewsFilters | undefined): Record<string, unknown>[] => {
  const clauses: Record<string, unknown>[] = [
    {
      term: {
        status: 'PUBLISHED',
      },
    },
  ];

  if (filters?.categoryTierLevels?.length) {
    clauses.push({
      terms: {
        categoryTierLevel: filters.categoryTierLevels,
      },
    });
  }

  if (filters?.adBoostStatuses?.length) {
    clauses.push({
      terms: {
        adBoostStatus: filters.adBoostStatuses,
      },
    });
  }

  return clauses;
};

const buildBaseQuery = (
  filters: SearchReviewsFilters | undefined,
  query?: string,
): Record<string, unknown> => {
  const trimmedQuery = query?.trim();
  const filterClauses = buildFilterClauses(filters);

  const boolQuery: Record<string, unknown> = {};

  if (filterClauses.length > 0) {
    boolQuery.filter = filterClauses;
  }

  if (trimmedQuery && trimmedQuery.length > 0) {
    boolQuery.must = [
      {
        multi_match: {
          query: trimmedQuery,
          fields: ['title^3', 'content'],
          type: 'most_fields',
          operator: 'and',
          analyzer: 'folded',
          fuzziness: 'AUTO',
        },
      },
    ];
  }

  return Object.keys(boolQuery).length > 0 ? { bool: boolQuery } : { match_all: {} };
};

const buildFunctionScoreQuery = (
  filters: SearchReviewsFilters | undefined,
  query?: string,
): Record<string, unknown> => ({
  function_score: {
    query: buildBaseQuery(filters, query),
    score_mode: 'sum',
    boost_mode: 'sum',
    functions: [
      {
        filter: {
          term: {
            adBoostStatus: 'boosted',
          },
        },
        weight: 5,
      },
      {
        field_value_factor: {
          field: 'activityTotalQuantity',
          factor: 0.2,
          modifier: 'sqrt',
          missing: 0,
        },
      },
      {
        field_value_factor: {
          field: 'boostCreditsRemaining',
          factor: 0.5,
          modifier: 'ln1p',
          missing: 0,
        },
      },
    ],
  },
});

const clampPage = (page?: number): number => {
  if (!page || Number.isNaN(page) || page < 1) {
    return DEFAULT_PAGE;
  }

  return Math.floor(page);
};

const clampPageSize = (pageSize?: number): number => {
  if (!pageSize || Number.isNaN(pageSize) || pageSize < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE);
};

const extractTotalHits = (hitsSection: unknown): number => {
  if (!hitsSection || typeof hitsSection !== 'object') {
    return 0;
  }

  const total = (hitsSection as { total?: unknown }).total;

  if (typeof total === 'number') {
    return total;
  }

  if (total && typeof total === 'object' && 'value' in total) {
    const value = (total as { value?: unknown }).value;
    if (typeof value === 'number') {
      return value;
    }
  }

  return 0;
};

const extractHits = (hitsSection: unknown): SearchReviewsResult['results'] => {
  if (!hitsSection || typeof hitsSection !== 'object') {
    return [];
  }

  const hits = (hitsSection as { hits?: unknown }).hits;

  if (!Array.isArray(hits)) {
    return [];
  }

  return hits
    .filter((hit): hit is { _id: string; _score?: number; _source?: ReviewSearchDocument } =>
      typeof hit === 'object' && hit !== null && typeof (hit as { _id?: unknown })._id === 'string',
    )
    .map((hit) => ({
      id: hit._id,
      score: typeof hit._score === 'number' ? hit._score : 0,
      review: (hit._source ?? {}) as ReviewSearchDocument,
    }));
};

const extractBuckets = (aggregation: unknown): SearchAggregationBucket[] => {
  if (!aggregation || typeof aggregation !== 'object') {
    return [];
  }

  const buckets = (aggregation as { buckets?: unknown }).buckets;

  if (!Array.isArray(buckets)) {
    return [];
  }

  return buckets
    .filter((bucket): bucket is { key: unknown; doc_count: unknown } =>
      typeof bucket === 'object' && bucket !== null,
    )
    .map((bucket) => ({
      key: String((bucket as { key: unknown }).key ?? 'unknown'),
      docCount:
        typeof (bucket as { doc_count: unknown }).doc_count === 'number'
          ? (bucket as { doc_count: number }).doc_count
          : 0,
    }));
};

export const createSearchService = (client: Client): SearchService => ({
  async searchReviews(params) {
    const page = clampPage(params.page);
    const pageSize = clampPageSize(params.pageSize);
    const from = (page - 1) * pageSize;

    const query = buildFunctionScoreQuery(params.filters, params.query);

    const body: Record<string, unknown> = {
      from,
      size: pageSize,
      track_total_hits: true,
      query,
      aggs: {
        categoryTierLevels: {
          terms: {
            field: 'categoryTierLevel',
            size: 3,
            missing: 'unknown',
          },
        },
        adBoostStatus: {
          terms: {
            field: 'adBoostStatus',
            size: 2,
          },
        },
      },
    };

    if (params.sort === 'newest') {
      body.sort = [{ createdAt: { order: 'desc' } }];
    } else {
      body.sort = [
        { _score: { order: 'desc' } },
        { createdAt: { order: 'desc' } },
      ];
    }

    const response = await client.search({
      index: REVIEW_INDEX_ALIAS,
      body,
    });

    const responseBody = 'body' in response ? (response as { body: unknown }).body : response;
    const hitsSection = (responseBody as { hits?: unknown })?.hits;
    const aggregations = (responseBody as { aggregations?: unknown })?.aggregations ?? {};

    const total = extractTotalHits(hitsSection);
    const results = extractHits(hitsSection ?? {});

    return {
      page,
      pageSize,
      total,
      took:
        typeof (responseBody as { took?: unknown })?.took === 'number'
          ? ((responseBody as { took: number }).took)
          : 0,
      results,
      aggregations: {
        categoryTierLevels: extractBuckets((aggregations as Record<string, unknown>).categoryTierLevels),
        adBoostStatus: extractBuckets((aggregations as Record<string, unknown>).adBoostStatus),
      },
    } satisfies SearchReviewsResult;
  },
});
