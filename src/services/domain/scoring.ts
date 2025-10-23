import { User, ActivityType, BoostType } from '@prisma/client';

import { getScoringConfig } from '../../config/scoring';
import {
  ScoringRepository,
  UserScoreData,
  UserPerformanceMetrics,
  UserActivityMetrics,
  UserBoostMetrics,
} from '../../repositories/scoringRepository';

export interface CompositeScoreResult {
  compositeScore: number;
  performanceScore: number;
  activenessScore: number;
  boostScore: number;
  lastScoredAt: Date;
  metrics: {
    performance: UserPerformanceMetrics;
    activity: UserActivityMetrics;
    boost: UserBoostMetrics;
  };
}

export interface ScoringService {
  calculateUserScore(userId: string): Promise<CompositeScoreResult | null>;
  updateUserScore(userId: string): Promise<User | null>;
  getUserScore(userId: string): Promise<User | null>;
}

const normalizeValue = (value: number, max: number): number => {
  if (max === 0) return 0;
  return Math.min(value / max, 1);
};

const calculatePerformanceScore = (metrics: UserPerformanceMetrics): number => {
  const config = getScoringConfig();
  const { performanceWeights, maxNormalizedValues } = config;

  const normalizedRating = metrics.averageRating / 5.0;
  const normalizedTotalReviews = normalizeValue(
    metrics.totalReviews,
    maxNormalizedValues.totalReviews,
  );
  const normalizedPublishedReviews = normalizeValue(
    metrics.publishedReviews,
    maxNormalizedValues.totalReviews,
  );

  const performanceScore =
    normalizedRating * performanceWeights.averageRating +
    normalizedTotalReviews * performanceWeights.totalReviews +
    normalizedPublishedReviews * performanceWeights.publishedReviews;

  return Math.min(performanceScore, 1);
};

const calculateActivenessScore = (metrics: UserActivityMetrics): number => {
  const config = getScoringConfig();
  const { activityTypeWeights, maxNormalizedValues } = config;

  let weightedActivitySum = 0;

  metrics.activityCounts.forEach((activity) => {
    const weight = activityTypeWeights[activity.type as ActivityType] ?? 1;
    weightedActivitySum += activity.totalQuantity * weight;
  });

  const normalizedActivities = normalizeValue(
    weightedActivitySum,
    maxNormalizedValues.totalActivities,
  );

  return normalizedActivities;
};

const calculateBoostScore = (metrics: UserBoostMetrics): number => {
  const config = getScoringConfig();
  const { boostTypeWeights, maxNormalizedValues } = config;

  let weightedBoostSum = 0;

  metrics.activeBoosts.forEach((boost) => {
    const weight = boostTypeWeights[boost.boostType as BoostType] ?? 1;
    weightedBoostSum += boost.creditsRemaining * weight;
  });

  const normalizedBoost = normalizeValue(
    weightedBoostSum,
    maxNormalizedValues.totalBoostCredits,
  );

  return normalizedBoost;
};

export const createScoringService = (repository: ScoringRepository): ScoringService => {
  const calculateScore = async (userId: string): Promise<CompositeScoreResult | null> => {
    const userExists = await repository.ensureUserExists(userId);

    if (!userExists) {
      return null;
    }

    const [performanceMetrics, activityMetrics, boostMetrics] = await Promise.all([
      repository.getUserPerformanceMetrics(userId),
      repository.getUserActivityMetrics(userId),
      repository.getUserBoostMetrics(userId),
    ]);

    const performanceScore = calculatePerformanceScore(performanceMetrics);
    const activenessScore = calculateActivenessScore(activityMetrics);
    const boostScore = calculateBoostScore(boostMetrics);

    const config = getScoringConfig();
    const compositeScore =
      performanceScore * config.weights.performance +
      activenessScore * config.weights.activeness +
      boostScore * config.weights.boost;

    return {
      compositeScore: Math.min(compositeScore, 1),
      performanceScore,
      activenessScore,
      boostScore,
      lastScoredAt: new Date(),
      metrics: {
        performance: performanceMetrics,
        activity: activityMetrics,
        boost: boostMetrics,
      },
    };
  };

  return {
    calculateUserScore: calculateScore,
    async updateUserScore(userId) {
      const scoreResult = await calculateScore(userId);

      if (!scoreResult) {
        return null;
      }

      const scoreData: UserScoreData = {
        compositeScore: scoreResult.compositeScore,
        performanceScore: scoreResult.performanceScore,
        activenessScore: scoreResult.activenessScore,
        boostScore: scoreResult.boostScore,
        lastScoredAt: scoreResult.lastScoredAt,
      };

      return repository.updateUserScore(userId, scoreData);
    },
    getUserScore: (userId) => repository.getUserWithScores(userId),
  };
};
