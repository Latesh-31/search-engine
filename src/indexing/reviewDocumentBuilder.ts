import type { ReviewForIndexing } from './reviewIndexingRepository';
import type { AdBoostStatus, CategoryTierLevel, ReviewSearchDocument } from '../types/search';

const determineCategoryTierLevel = (priority: number): CategoryTierLevel => {
  if (priority <= 33) {
    return 'lower';
  }

  if (priority <= 66) {
    return 'medium';
  }

  return 'higher';
};

const resolveCategoryTierLevel = (
  priority: number | null | undefined,
): CategoryTierLevel | null => {
  if (priority === null || priority === undefined) {
    return null;
  }

  return determineCategoryTierLevel(priority);
};

const calculateActivityTotalQuantity = (
  metrics: ReviewForIndexing['activityCounts'],
): number => metrics.reduce((sum, metric) => sum + metric.quantity, 0);

const calculateBoostTotals = (boosts: ReviewForIndexing['boostPurchases']): {
  purchased: number;
  consumed: number;
} =>
  boosts.reduce(
    (totals, boost) => {
      totals.purchased += boost.creditsPurchased;
      totals.consumed += boost.creditsConsumed;
      return totals;
    },
    { purchased: 0, consumed: 0 },
  );

const resolveAdBoostStatus = (remainingCredits: number): AdBoostStatus =>
  remainingCredits > 0 ? 'boosted' : 'organic';

export const buildReviewDocument = (review: ReviewForIndexing): ReviewSearchDocument => {
  const activityTotalQuantity = calculateActivityTotalQuantity(review.activityCounts);
  const boostTotals = calculateBoostTotals(review.boostPurchases);
  const boostCreditsRemaining = Math.max(boostTotals.purchased - boostTotals.consumed, 0);
  const adBoostStatus = resolveAdBoostStatus(boostCreditsRemaining);

  return {
    id: review.id,
    userId: review.userId,
    categoryTierId: review.categoryTierId ?? null,
    categoryTierLevel: resolveCategoryTierLevel(review.categoryTier?.priority),
    title: review.title,
    content: review.content,
    rating: review.rating,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    author: {
      id: review.user.id,
      displayName: review.user.displayName,
      email: review.user.email,
    },
    category: review.categoryTier
      ? {
          id: review.categoryTier.id,
          name: review.categoryTier.name,
          priority: review.categoryTier.priority,
        }
      : null,
    activityTotalQuantity,
    boostCreditsPurchased: boostTotals.purchased,
    boostCreditsConsumed: boostTotals.consumed,
    boostCreditsRemaining,
    adBoostStatus,
  } satisfies ReviewSearchDocument;
};
