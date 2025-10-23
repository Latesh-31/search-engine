import { ActivityType, BoostType } from '@prisma/client';

import { ReviewForIndexing } from './reviewIndexingRepository';

export interface ReviewIndexDocument {
  id: string;
  title: string;
  content: string;
  rating: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    email: string;
  };
  category: {
    id: string;
    name: string;
    priority: number;
  } | null;
  activityTotals: Record<string, number>;
  activityTotalQuantity: number;
  boostCreditsByType: Record<string, number>;
  boostCreditsConsumed: number;
  boostCreditsPurchased: number;
}

const normaliseActivity = (metrics: ReviewForIndexing['activityCounts']): {
  totals: Record<string, number>;
  totalQuantity: number;
} => {
  const totals: Record<string, number> = {};
  let totalQuantity = 0;

  for (const metric of metrics) {
    const key = metric.type.toLowerCase() as Lowercase<ActivityType>;
    totals[key] = (totals[key] ?? 0) + metric.quantity;
    totalQuantity += metric.quantity;
  }

  return { totals, totalQuantity };
};

const normaliseBoosts = (boosts: ReviewForIndexing['boostPurchases']): {
  byType: Record<string, number>;
  purchased: number;
  consumed: number;
} => {
  const byType: Record<string, number> = {};
  let purchased = 0;
  let consumed = 0;

  for (const boost of boosts) {
    const key = boost.boostType.toLowerCase() as Lowercase<BoostType>;
    byType[key] = (byType[key] ?? 0) + boost.creditsPurchased;
    purchased += boost.creditsPurchased;
    consumed += boost.creditsConsumed;
  }

  return { byType, purchased, consumed };
};

export const buildReviewDocument = (review: ReviewForIndexing): ReviewIndexDocument => {
  const activity = normaliseActivity(review.activityCounts);
  const boosts = normaliseBoosts(review.boostPurchases);

  return {
    id: review.id,
    title: review.title,
    content: review.content,
    rating: review.rating,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    author: {
      id: review.userId,
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
    activityTotals: activity.totals,
    activityTotalQuantity: activity.totalQuantity,
    boostCreditsByType: boosts.byType,
    boostCreditsConsumed: boosts.consumed,
    boostCreditsPurchased: boosts.purchased,
  };
};
