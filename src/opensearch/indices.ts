import env from '../config/env';

export interface IndexDefinition {
  templateName: string;
  indexPatterns: string[];
  alias: string;
  initialIndex: string;
  settings: Record<string, unknown>;
  mappings: Record<string, unknown>;
  priority?: number;
}

const sharedAnalysis = {
  analyzer: {
    folded: {
      type: 'custom',
      tokenizer: 'standard',
      filter: ['lowercase', 'asciifolding'],
    },
    autocomplete: {
      type: 'custom',
      tokenizer: 'standard',
      filter: ['lowercase', 'asciifolding', 'autocomplete_filter'],
    },
  },
  filter: {
    autocomplete_filter: {
      type: 'edge_ngram',
      min_gram: 2,
      max_gram: 20,
    },
  },
  normalizer: {
    keyword_lowercase: {
      type: 'custom',
      filter: ['lowercase', 'asciifolding'],
    },
  },
};

const baseSettings = {
  number_of_shards: 1,
  number_of_replicas: env.NODE_ENV === 'production' ? 1 : 0,
  analysis: sharedAnalysis,
};

const reviewMappings = {
  dynamic: 'strict',
  properties: {
    id: { type: 'keyword' },
    userId: { type: 'keyword' },
    categoryTierId: { type: 'keyword' },
    title: {
      type: 'text',
      analyzer: 'folded',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete',
          search_analyzer: 'folded',
        },
      },
    },
    content: {
      type: 'text',
      analyzer: 'folded',
    },
    rating: { type: 'integer' },
    status: {
      type: 'keyword',
      normalizer: 'keyword_lowercase',
    },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
    helpfulVoteCount: { type: 'long' },
    viewCount: { type: 'long' },
    averageSentiment: { type: 'half_float' },
    keywords: {
      type: 'keyword',
      normalizer: 'keyword_lowercase',
    },
    lastActivityAt: { type: 'date' },
  },
};

const reviewActivitiesMappings = {
  dynamic: 'strict',
  properties: {
    id: { type: 'keyword' },
    reviewId: { type: 'keyword' },
    userId: { type: 'keyword' },
    type: {
      type: 'keyword',
      normalizer: 'keyword_lowercase',
    },
    quantity: { type: 'integer' },
    recordedAt: { type: 'date' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
    notes: {
      type: 'text',
      analyzer: 'folded',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
      },
    },
    aggregation: {
      properties: {
        rolling7d: { type: 'integer' },
        rolling30d: { type: 'integer' },
        total: { type: 'long' },
      },
    },
  },
};

export const REVIEW_INDEX_ALIAS = 'reviews';
export const REVIEW_INDEX_TEMPLATE_NAME = 'reviews-template-v1';
export const REVIEW_INDEX_INITIAL = 'reviews-v1';

export const REVIEW_ACTIVITY_INDEX_ALIAS = 'review-activities';
export const REVIEW_ACTIVITY_INDEX_TEMPLATE_NAME = 'review-activities-template-v1';
export const REVIEW_ACTIVITY_INDEX_INITIAL = 'review-activities-v1';

export const INDEX_DEFINITIONS: IndexDefinition[] = [
  {
    templateName: REVIEW_INDEX_TEMPLATE_NAME,
    indexPatterns: ['reviews-*'],
    alias: REVIEW_INDEX_ALIAS,
    initialIndex: REVIEW_INDEX_INITIAL,
    priority: 200,
    settings: baseSettings,
    mappings: reviewMappings,
  },
  {
    templateName: REVIEW_ACTIVITY_INDEX_TEMPLATE_NAME,
    indexPatterns: ['review-activities-*'],
    alias: REVIEW_ACTIVITY_INDEX_ALIAS,
    initialIndex: REVIEW_ACTIVITY_INDEX_INITIAL,
    priority: 200,
    settings: baseSettings,
    mappings: reviewActivitiesMappings,
  },
];
